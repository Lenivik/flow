class ReplicateBgRemoval
  API_URL = "https://api.replicate.com/v1/predictions"
  MODEL_VERSION = "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003"

  def initialize(image_url:)
    @image_url = image_url
  end

  def call
    api_token = Rails.application.credentials.replicate_api_token
    raise "Replicate API token not configured" if api_token.blank?

    # Create prediction
    response = HTTParty.post(
      API_URL,
      headers: {
        "Authorization" => "Bearer #{api_token}",
        "Content-Type" => "application/json"
      },
      body: {
        version: MODEL_VERSION,
        input: { image: @image_url }
      }.to_json,
      timeout: 30
    )

    unless response.success?
      parsed = response.parsed_response
      error_msg = parsed.is_a?(Hash) ? parsed["detail"] : response.body
      raise "Replicate API error: #{error_msg}"
    end

    prediction = response.parsed_response
    prediction_url = prediction.dig("urls", "get")

    # Poll for completion
    60.times do
      sleep 1

      poll = HTTParty.get(
        prediction_url,
        headers: { "Authorization" => "Bearer #{api_token}" },
        timeout: 15
      )

      parsed = poll.parsed_response
      status = parsed["status"]
      case status
      when "succeeded"
        output_url = parsed["output"]
        return download_image(output_url)
      when "failed", "canceled"
        raise "Replicate prediction #{status}: #{parsed['error']}"
      end
    end

    raise "Replicate prediction timed out"
  end

  private

  def download_image(url)
    response = HTTParty.get(url, timeout: 30)
    raise "Failed to download result image" unless response.success?

    content_type = response.headers["content-type"] || "image/png"
    image_data = Base64.strict_encode64(response.body)

    { image_data: image_data, mime_type: content_type }
  end
end
