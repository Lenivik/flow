class FalTrellis < FalService
  ENDPOINT = "https://queue.fal.run/fal-ai/trellis"

  def initialize(image_url:, settings: {})
    @image_url = image_url
    @settings = settings
  end

  def call
    input = { image_url: @image_url }
    input[:seed] = @settings["seed"].to_i if @settings["seed"].present?
    input[:texture_size] = @settings["texture_size"].to_i if @settings["texture_size"].present?
    input[:mesh_simplify] = @settings["mesh_simplify"].to_f if @settings["mesh_simplify"].present?
    input[:ss_sampling_steps] = @settings["ss_sampling_steps"].to_i if @settings["ss_sampling_steps"].present?
    input[:slat_sampling_steps] = @settings["slat_sampling_steps"].to_i if @settings["slat_sampling_steps"].present?
    input[:ss_guidance_strength] = @settings["ss_guidance_strength"].to_f if @settings["ss_guidance_strength"].present?
    input[:slat_guidance_strength] = @settings["slat_guidance_strength"].to_f if @settings["slat_guidance_strength"].present?

    output = submit_and_poll(ENDPOINT, input)
    parse_output(output)
  end

  private

  def parse_output(output)
    model_mesh = output["model_mesh"]
    raise ApiError, "No model mesh in output" unless model_mesh&.dig("url")

    result = download_file(model_mesh["url"])

    { image_data: Base64.strict_encode64(result.body), mime_type: "model/gltf-binary" }
  end
end
