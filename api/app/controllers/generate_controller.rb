class GenerateController < ApplicationController
  rate_limit to: 30, within: 1.hour, only: %i[image flux2_flash flux2_edit remove_bg trellis meshy_v6]
  rate_limit to: 60, within: 1.hour, only: %i[upload_image]

  def image
    prompt = params[:prompt]
    negative_prompt = params[:negative_prompt]

    if prompt.blank?
      return render json: { error: "Prompt is required" }, status: :unprocessable_entity
    end

    result = FalNanoBanana.new(
      prompt: prompt,
      negative_prompt: negative_prompt,
      aspect_ratio: params[:aspect_ratio],
      resolution: params[:resolution],
      output_format: params[:output_format],
      seed: params[:seed],
      safety_tolerance: params[:safety_tolerance]
    ).call

    node_image = save_result_to_node(result, prompt: prompt, negative_prompt: negative_prompt)

    render json: {
      image_data: result[:image_data],
      mime_type: result[:mime_type],
      text: result[:text],
      node_image_id: node_image&.id
    }
  rescue FalService::ApiError => e
    Rails.logger.warn("fal.ai API error in image generation: #{e.message}")
    render json: { error: e.message }, status: :bad_gateway
  rescue => e
    Rails.logger.error("Image generation failed: #{e.class} - #{e.message}\n#{e.backtrace&.first(10)&.join("\n")}")
    render json: { error: "Image generation failed" }, status: :internal_server_error
  end

  def flux2_flash
    prompt = params[:prompt]

    if prompt.blank?
      return render json: { error: "Prompt is required" }, status: :unprocessable_entity
    end

    result = FalFlux2Flash.new(
      prompt: prompt,
      image_size: params[:image_size],
      guidance_scale: params[:guidance_scale],
      seed: params[:seed],
      output_format: params[:output_format],
      enable_prompt_expansion: params[:enable_prompt_expansion],
      enable_safety_checker: params[:enable_safety_checker]
    ).call

    node_image = save_result_to_node(result, prompt: prompt)

    render json: {
      image_data: result[:image_data],
      mime_type: result[:mime_type],
      node_image_id: node_image&.id
    }
  rescue FalService::ApiError => e
    Rails.logger.warn("fal.ai API error in Flux 2 Flash: #{e.message}")
    render json: { error: e.message }, status: :bad_gateway
  rescue => e
    Rails.logger.error("Flux 2 Flash generation failed: #{e.class} - #{e.message}\n#{e.backtrace&.first(10)&.join("\n")}")
    render json: { error: "Image generation failed" }, status: :internal_server_error
  end

  def flux2_edit
    prompt = params[:prompt]
    if prompt.blank?
      return render json: { error: "Prompt is required" }, status: :unprocessable_entity
    end

    # capture_data is a data URI sent inline from the Trellis viewport capture
    data_uri = if params[:capture_data].present?
      params[:capture_data]
    else
      source_image = load_source_image
      "data:#{source_image.mime_type};base64,#{source_image.image_data}"
    end

    settings = params.permit(
      :guidance_scale, :num_inference_steps, :image_size,
      :output_format, :seed, :enable_safety_checker
    ).to_h

    result = FalFlux2Edit.new(prompt: prompt, image_url: data_uri, settings: settings).call

    node_image = save_result_to_node(result, prompt: prompt)

    render json: {
      image_data: result[:image_data],
      mime_type: result[:mime_type],
      node_image_id: node_image&.id
    }
  rescue FalService::ApiError => e
    Rails.logger.warn("fal.ai API error in Flux 2 Edit: #{e.message}")
    render json: { error: e.message }, status: :bad_gateway
  rescue => e
    Rails.logger.error("Flux 2 Edit failed: #{e.class} - #{e.message}\n#{e.backtrace&.first(10)&.join("\n")}")
    render json: { error: "Image editing failed" }, status: :internal_server_error
  end

  def remove_bg
    data_uri = if params[:capture_data].present?
      params[:capture_data]
    else
      source_image = load_source_image
      "data:#{source_image.mime_type};base64,#{source_image.image_data}"
    end

    result = FalBgRemoval.new(image_url: data_uri).call

    node_image = save_result_to_node(result, prompt: "background removal")

    render json: {
      image_data: result[:image_data],
      mime_type: result[:mime_type],
      node_image_id: node_image&.id
    }
  rescue FalService::ApiError => e
    Rails.logger.warn("fal.ai API error in BG removal: #{e.message}")
    render json: { error: e.message }, status: :bad_gateway
  rescue => e
    Rails.logger.error("BG removal failed: #{e.class} - #{e.message}\n#{e.backtrace&.first(10)&.join("\n")}")
    render json: { error: "Background removal failed" }, status: :internal_server_error
  end

  def trellis
    source_image = load_source_image
    data_uri = "data:#{source_image.mime_type};base64,#{source_image.image_data}"

    settings = params.permit(
      :seed, :texture_size, :mesh_simplify, :ss_sampling_steps,
      :slat_sampling_steps, :ss_guidance_strength, :slat_guidance_strength
    ).to_h

    result = FalTrellis.new(image_url: data_uri, settings: settings).call

    node_image = save_result_to_node(result, prompt: "trellis 3d generation")

    render json: {
      image_data: result[:image_data],
      mime_type: result[:mime_type],
      node_image_id: node_image&.id
    }
  rescue FalService::ApiError => e
    Rails.logger.warn("fal.ai API error in Trellis: #{e.message}")
    render json: { error: e.message }, status: :bad_gateway
  rescue => e
    Rails.logger.error("Trellis generation failed: #{e.class} - #{e.message}\n#{e.backtrace&.first(10)&.join("\n")}")
    render json: { error: "3D generation failed" }, status: :internal_server_error
  end

  def meshy_v6
    source_image = load_source_image
    data_uri = "data:#{source_image.mime_type};base64,#{source_image.image_data}"

    settings = params.permit(:art_style, :topology, :target_polycount, :symmetry_mode, :pose_mode,
                             :should_remesh, :should_texture, :enable_pbr, :texture_prompt).to_h

    # Resolve optional texture image from a connected canvas node (secure: scoped to current user)
    if params[:texture_image_id].present?
      texture_image = NodeImage.joins(node: { project: :user })
        .where(projects: { user_id: Current.session.user_id })
        .find_by(id: params[:texture_image_id])
      settings["texture_image_url"] = "data:#{texture_image.mime_type};base64,#{texture_image.image_data}" if texture_image
    end

    result = FalMeshyV6.new(image_url: data_uri, settings: settings).call

    node_image = save_result_to_node(result, prompt: "meshy v6 3d generation")

    render json: {
      image_data: result[:image_data],
      mime_type: result[:mime_type],
      node_image_id: node_image&.id
    }
  rescue FalService::ApiError => e
    Rails.logger.warn("fal.ai API error in Meshy v6: #{e.message}")
    render json: { error: e.message }, status: :bad_gateway
  rescue => e
    Rails.logger.error("Meshy v6 generation failed: #{e.class} - #{e.message}\n#{e.backtrace&.first(10)&.join("\n")}")
    render json: { error: "3D generation failed" }, status: :internal_server_error
  end

  def upload_image
    file = params[:image]
    return render json: { error: "Image file is required" }, status: :unprocessable_entity unless file.present?

    image_data = Base64.strict_encode64(file.read)
    mime_type = file.content_type.presence || "image/png"

    result = { image_data: image_data, mime_type: mime_type }
    node_image = save_result_to_node(result, prompt: "uploaded image")

    render json: { node_image_id: node_image&.id, mime_type: mime_type }
  rescue => e
    Rails.logger.error("Image upload failed: #{e.class} - #{e.message}\n#{e.backtrace&.first(5)&.join("\n")}")
    render json: { error: "Upload failed" }, status: :internal_server_error
  end

  private

  def load_source_image
    source_image_id = params[:source_image_id]
    raise FalService::ApiError, "Source image is required" if source_image_id.blank?

    NodeImage.joins(node: { project: :user })
      .where(projects: { user_id: Current.session.user_id })
      .find(source_image_id)
  end

  def save_result_to_node(result, prompt:, negative_prompt: nil)
    return nil unless result[:image_data]

    node_id = params[:node_id]
    return nil unless node_id.present?

    node = Node.joins(project: :user)
      .where(projects: { user_id: Current.session.user_id })
      .find_by(id: node_id)

    return nil unless node

    node.node_images.create!(
      image_data: result[:image_data],
      mime_type: result[:mime_type],
      prompt: prompt,
      negative_prompt: negative_prompt
    )
  end
end
