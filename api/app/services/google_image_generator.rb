class GoogleImageGenerator
  API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent"

  def initialize(prompt:, negative_prompt: nil)
    @prompt = prompt
    @negative_prompt = negative_prompt
  end

  def call
    api_key = Rails.application.credentials.google_genai_api_key
    raise "Google GenAI API key not configured" if api_key.blank? || api_key == "YOUR_GOOGLE_API_KEY_HERE"

    full_prompt = @prompt
    full_prompt += "\n\nAvoid: #{@negative_prompt}" if @negative_prompt.present?

    response = HTTParty.post(
      "#{API_URL}?key=#{api_key}",
      headers: { "Content-Type" => "application/json" },
      body: {
        contents: [ { parts: [ { text: full_prompt } ] } ],
        generationConfig: { responseModalities: [ "TEXT", "IMAGE" ] }
      }.to_json,
      timeout: 60
    )

    unless response.success?
      error_msg = response.dig("error", "message") || response.body
      raise "Google API error: #{error_msg}"
    end

    parts = response.dig("candidates", 0, "content", "parts") || []

    result = { text: nil, image_data: nil, mime_type: nil }

    parts.each do |part|
      if part["text"]
        result[:text] = part["text"]
      elsif part["inlineData"]
        result[:image_data] = part["inlineData"]["data"]
        result[:mime_type] = part["inlineData"]["mimeType"]
      end
    end

    result
  end
end
