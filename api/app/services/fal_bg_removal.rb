class FalBgRemoval < FalService
  ENDPOINT = "https://queue.fal.run/fal-ai/bria/background/remove"

  def initialize(image_url:)
    @image_url = image_url
  end

  def call
    output = submit_and_poll(ENDPOINT, { image_url: @image_url })
    parse_output(output)
  end

  private

  def parse_output(output)
    image = output["image"]
    raise ApiError, "No image in output" unless image&.dig("url")

    result = download_as_base64(image["url"])
    content_type = image["content_type"] || result[:mime_type]

    { image_data: result[:data], mime_type: content_type }
  end
end
