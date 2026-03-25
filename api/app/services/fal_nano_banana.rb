class FalNanoBanana < FalService
  ENDPOINT = "https://queue.fal.run/fal-ai/nano-banana-2"

  def initialize(prompt:, negative_prompt: nil, aspect_ratio: nil, resolution: nil, output_format: nil, seed: nil, safety_tolerance: nil)
    @prompt = prompt
    @negative_prompt = negative_prompt
    @aspect_ratio = aspect_ratio
    @resolution = resolution
    @output_format = output_format
    @seed = seed
    @safety_tolerance = safety_tolerance
  end

  def call
    full_prompt = @prompt
    full_prompt += "\n\nAvoid: #{@negative_prompt}" if @negative_prompt.present?

    input = { prompt: full_prompt, num_images: 1, limit_generations: true }
    input[:aspect_ratio] = @aspect_ratio if @aspect_ratio.present?
    input[:resolution] = @resolution if @resolution.present?
    input[:output_format] = @output_format if @output_format.present?
    input[:seed] = @seed.to_i if @seed.present?
    input[:safety_tolerance] = @safety_tolerance.to_s if @safety_tolerance.present?

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

    { image_data: result[:data], mime_type: content_type, text: output["description"] }
  end
end
