class FalService
  class ApiError < StandardError; end

  private

  def fal_headers
    api_key = Rails.application.credentials.fal_api_key
    raise ApiError, "fal.ai API key not configured" if api_key.blank?

    {
      "Authorization" => "Key #{api_key}",
      "Content-Type" => "application/json"
    }
  end

  def submit_and_poll(url, input)
    headers = fal_headers

    response = HTTParty.post(url, headers: headers, body: input.to_json, timeout: 30)

    unless response.success?
      parsed = response.parsed_response
      error_msg = parsed.is_a?(Hash) ? (parsed["detail"] || parsed["message"]) : response.body
      raise ApiError, "fal.ai API error: #{error_msg}"
    end

    parsed_response = response.parsed_response
    status_url = parsed_response["status_url"]
    result_url = parsed_response["response_url"]

    120.times do
      sleep 2

      poll = HTTParty.get(status_url, headers: headers, timeout: 15)
      parsed = poll.parsed_response

      case parsed["status"]
      when "COMPLETED"
        result = HTTParty.get(result_url, headers: headers, timeout: 30)
        return result.parsed_response
      when "FAILED"
        raise ApiError, "fal.ai request failed: #{parsed['error']}"
      end
    end

    raise ApiError, "fal.ai request timed out"
  end

  def download_file(url)
    response = HTTParty.get(url, timeout: 60)
    raise ApiError, "Failed to download file from #{url}" unless response.success?
    response
  end

  def download_as_base64(url, fallback_mime: "image/png")
    response = download_file(url)
    content_type = response.headers["content-type"] || fallback_mime
    {
      data: Base64.strict_encode64(response.body),
      mime_type: content_type
    }
  end
end
