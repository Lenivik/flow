class GenerateController < ApplicationController
  def image
    prompt = params[:prompt]
    negative_prompt = params[:negative_prompt]
    node_id = params[:node_id]

    if prompt.blank?
      return render json: { error: "Prompt is required" }, status: :unprocessable_entity
    end

    result = GoogleImageGenerator.new(
      prompt: prompt,
      negative_prompt: negative_prompt,
      aspect_ratio: params[:aspect_ratio],
      resolution: params[:resolution],
      image_size: params[:image_size]
    ).call

    if result[:image_data]
      # Save to node if node_id is provided and belongs to current user
      node_image = nil
      if node_id.present?
        node = Node.joins(project: :user)
          .where(projects: { user_id: Current.session.user_id })
          .find_by(id: node_id)

        if node
          node_image = node.node_images.create!(
            image_data: result[:image_data],
            mime_type: result[:mime_type],
            prompt: prompt,
            negative_prompt: negative_prompt
          )
        end
      end

      render json: {
        image_data: result[:image_data],
        mime_type: result[:mime_type],
        text: result[:text],
        node_image_id: node_image&.id
      }
    else
      render json: { error: "No image was generated", text: result[:text] }, status: :unprocessable_entity
    end
  rescue => e
    render json: { error: e.message }, status: :internal_server_error
  end

  def remove_bg
    source_image_id = params[:source_image_id]
    node_id = params[:node_id]

    if source_image_id.blank?
      return render json: { error: "Source image is required" }, status: :unprocessable_entity
    end

    # Load the source image and build a data URI for Replicate
    source_image = NodeImage.joins(node: { project: :user })
      .where(projects: { user_id: Current.session.user_id })
      .find(source_image_id)

    data_uri = "data:#{source_image.mime_type};base64,#{source_image.image_data}"

    result = ReplicateBgRemoval.new(image_url: data_uri).call

    if result[:image_data]
      node_image = nil
      if node_id.present?
        node = Node.joins(project: :user)
          .where(projects: { user_id: Current.session.user_id })
          .find_by(id: node_id)

        if node
          node_image = node.node_images.create!(
            image_data: result[:image_data],
            mime_type: result[:mime_type],
            prompt: "background removal"
          )
        end
      end

      render json: {
        image_data: result[:image_data],
        mime_type: result[:mime_type],
        node_image_id: node_image&.id
      }
    else
      render json: { error: "Background removal failed" }, status: :unprocessable_entity
    end
  rescue => e
    render json: { error: e.message }, status: :internal_server_error
  end

  def trellis
    source_image_id = params[:source_image_id]
    node_id = params[:node_id]

    if source_image_id.blank?
      return render json: { error: "Source image is required" }, status: :unprocessable_entity
    end

    source_image = NodeImage.joins(node: { project: :user })
      .where(projects: { user_id: Current.session.user_id })
      .find(source_image_id)

    data_uri = "data:#{source_image.mime_type};base64,#{source_image.image_data}"

    settings = params.permit(
      :seed, :texture_size, :mesh_simplify, :generate_color, :generate_model,
      :randomize_seed, :generate_normal, :save_gaussian_ply, :ss_sampling_steps,
      :slat_sampling_steps, :return_no_background, :ss_guidance_strength, :slat_guidance_strength
    ).to_h

    result = ReplicateTrellis.new(image_url: data_uri, settings: settings).call

    if result[:image_data]
      node_image = nil
      if node_id.present?
        node = Node.joins(project: :user)
          .where(projects: { user_id: Current.session.user_id })
          .find_by(id: node_id)

        if node
          node_image = node.node_images.create!(
            image_data: result[:image_data],
            mime_type: result[:mime_type],
            prompt: "trellis 3d generation"
          )
        end
      end

      render json: {
        image_data: result[:image_data],
        mime_type: result[:mime_type],
        node_image_id: node_image&.id
      }
    else
      render json: { error: "3D generation failed" }, status: :unprocessable_entity
    end
  rescue => e
    render json: { error: e.message }, status: :internal_server_error
  end
end
