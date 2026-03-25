class FalFlux2Flash < FalService
  ENDPOINT = "https://queue.fal.run/fal-ai/flux-2/flash"

  def initialize(prompt:, image_size: nil, guidance_scale: nil, seed: nil,
                 output_format: nil, enable_prompt_expansion: nil, enable_safety_checker: nil)
    @prompt = prompt
    @image_size = image_size
    @guidance_scale = guidance_scale
    @seed = seed
    @output_format = output_format
    @enable_prompt_expansion = enable_prompt_expansion
    @enable_safety_checker = enable_safety_checker
  end

  def call
    input = { prompt: @prompt, num_images: 1 }
    input[:image_size] = @image_size if @image_size.present?
    input[:guidance_scale] = @guidance_scale.to_f if @guidance_scale.present?
    input[:seed] = @seed.to_i if @seed.present?
    input[:output_format] = @output_format if @output_format.present?
    input[:enable_prompt_expansion] = @enable_prompt_expansion == "true" || @enable_prompt_expansion == true unless @enable_prompt_expansion.nil?
    input[:enable_safety_checker] = @enable_safety_checker == "true" || @enable_safety_checker == true unless @enable_safety_checker.nil?

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
