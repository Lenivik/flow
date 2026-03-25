class GenerateController < ApplicationController
  rate_limit to: 30, within: 1.hour, only: %i[image flux2_flash remove_bg trellis]

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

  def remove_bg
    source_image = load_source_image
    data_uri = "data:#{source_image.mime_type};base64,#{source_image.image_data}"

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
