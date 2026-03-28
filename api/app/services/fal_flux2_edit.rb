class FalFlux2Edit < FalService
  ENDPOINT = "https://queue.fal.run/fal-ai/flux-2/edit"

  def initialize(prompt:, image_url:, settings: {})
    @prompt = prompt
    @image_url = image_url
    @settings = settings
  end

  def call
    input = { prompt: @prompt, image_urls: [@image_url], num_images: 1 }
    input[:guidance_scale] = @settings["guidance_scale"].to_f if @settings["guidance_scale"].present?
    input[:num_inference_steps] = @settings["num_inference_steps"].to_i if @settings["num_inference_steps"].present?
    input[:image_size] = @settings["image_size"] if @settings["image_size"].present?
    input[:output_format] = @settings["output_format"] if @settings["output_format"].present?
    input[:seed] = @settings["seed"].to_i if @settings["seed"].present?
    input[:enable_safety_checker] = [true, "true"].include?(@settings["enable_safety_checker"]) unless @settings["enable_safety_checker"].nil?

    output = submit_and_poll(ENDPOINT, input)
    parse_output(output)
  end

  private

  def parse_output(output)
    images = output["images"]
    raise ApiError, "No images in output" unless images&.any?

    image = images.first
    raise ApiError, "No image URL in output" unless image&.dig("url")

    result = download_as_base64(image["url"])
    content_type = image["content_type"] || result[:mime_type]
    { image_data: result[:data], mime_type: content_type }
  end
end
