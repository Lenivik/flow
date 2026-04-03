class FalMeshyV6 < FalService
  ENDPOINT = "https://queue.fal.run/fal-ai/meshy/v6/image-to-3d"

  def initialize(image_url:, settings: {})
    @image_url = image_url
    @settings = settings
  end

  def call
    input = { image_url: @image_url }
    input[:art_style]       = @settings["art_style"]       if @settings["art_style"].present?
    input[:topology]        = @settings["topology"]        if @settings["topology"].present?
    input[:target_polycount] = @settings["target_polycount"].to_i if @settings["target_polycount"].present?
    input[:symmetry_mode]   = @settings["symmetry_mode"]   if @settings["symmetry_mode"].present?
    input[:pose_mode]       = @settings["pose_mode"]       if @settings["pose_mode"].present?
    input[:should_remesh]   = [true, "true"].include?(@settings["should_remesh"])  unless @settings["should_remesh"].nil?
    input[:should_texture]  = [true, "true"].include?(@settings["should_texture"]) unless @settings["should_texture"].nil?
    input[:enable_pbr]      = [true, "true"].include?(@settings["enable_pbr"])     unless @settings["enable_pbr"].nil?
    input[:texture_prompt]    = @settings["texture_prompt"]    if @settings["texture_prompt"].present?
    input[:texture_image_url] = @settings["texture_image_url"] if @settings["texture_image_url"].present?

    output = submit_and_poll(ENDPOINT, input)
    parse_output(output)
  end

  private

  def parse_output(output)
    # Meshy v6 returns model_meshes array; fall back to other known shapes
    glb_url = output.dig("model_meshes", 0, "glb") ||
              output.dig("model_mesh", "url") ||
              output["model_url"]

    raise ApiError, "No GLB model in output" unless glb_url

    result = download_file(glb_url)
    { image_data: Base64.strict_encode64(result.body), mime_type: "model/gltf-binary" }
  end
end
