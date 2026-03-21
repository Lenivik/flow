class GenerateController < ApplicationController
  def image
    prompt = params[:prompt]
    negative_prompt = params[:negative_prompt]
    node_id = params[:node_id]

    if prompt.blank?
      return render json: { error: "Prompt is required" }, status: :unprocessable_entity
    end

    result = GoogleImageGenerator.new(prompt: prompt, negative_prompt: negative_prompt).call

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
end
