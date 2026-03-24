class ReplicateTrellis
  API_URL = "https://api.replicate.com/v1/predictions"
  MODEL_VERSION = "e8f6c45206993f297372f5436b90350817bd9b4a0d52d2a76df50c1c8afa2b3c"

  def initialize(image_url:, settings: {})
    @image_url = image_url
    @settings = settings
  end

  def call
    api_token = Rails.application.credentials.replicate_api_token
    raise "Replicate API token not configured" if api_token.blank?

    input = {
      images: [@image_url],
      seed: (@settings["seed"] || 0).to_i,
      texture_size: (@settings["texture_size"] || 2048).to_i,
      mesh_simplify: (@settings["mesh_simplify"] || 0.9).to_f,
      generate_color: @settings.fetch("generate_color", true),
      generate_model: @settings.fetch("generate_model", true),
      randomize_seed: @settings.fetch("randomize_seed", true),
      generate_normal: @settings.fetch("generate_normal", false),
      save_gaussian_ply: @settings.fetch("save_gaussian_ply", false),
      ss_sampling_steps: (@settings["ss_sampling_steps"] || 38).to_i,
      slat_sampling_steps: (@settings["slat_sampling_steps"] || 12).to_i,
      return_no_background: @settings.fetch("return_no_background", false),
      ss_guidance_strength: (@settings["ss_guidance_strength"] || 7.5).to_f,
      slat_guidance_strength: (@settings["slat_guidance_strength"] || 3).to_f
    }

    response = HTTParty.post(
      API_URL,
      headers: {
        "Authorization" => "Bearer #{api_token}",
        "Content-Type" => "application/json"
      },
      body: {
        version: MODEL_VERSION,
        input: input
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

    # Poll for completion (Trellis can take a while)
    120.times do
      sleep 2

      poll = HTTParty.get(
        prediction_url,
        headers: { "Authorization" => "Bearer #{api_token}" },
        timeout: 15
      )

      parsed = poll.parsed_response
      status = parsed["status"]
      case status
      when "succeeded"
        return parse_output(parsed["output"])
      when "failed", "canceled"
        raise "Replicate prediction #{status}: #{parsed['error']}"
      end
    end

    raise "Replicate prediction timed out"
  end

  private

  def parse_output(output)
    result = {}

    if output.is_a?(Hash)
      # Download and store the GLB model file as base64
      if output["model_file"]
        glb = download_file(output["model_file"])
        result[:image_data] = glb[:data]
        result[:mime_type] = "model/gltf-binary"
      end

      # Keep URLs for optional extras (temporary Replicate URLs)
      result[:gaussian_ply_url] = output["gaussian_ply"] if output["gaussian_ply"]
    end

    result
  end

  def download_file(url)
    response = HTTParty.get(url, timeout: 60)
    raise "Failed to download model file" unless response.success?

    { data: Base64.strict_encode64(response.body) }
  end
end
