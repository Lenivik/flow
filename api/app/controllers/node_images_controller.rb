class NodeImagesController < ApplicationController
  def index
    node = Node.joins(project: :user)
      .where(projects: { user_id: Current.session.user_id })
      .find(params[:node_id])

    images = node.node_images.order(created_at: :desc).map do |img|
      { id: img.id, mime_type: img.mime_type, prompt: img.prompt, negative_prompt: img.negative_prompt, created_at: img.created_at }
    end

    render json: images
  end

  def show
    image = NodeImage.joins(node: { project: :user })
      .where(projects: { user_id: Current.session.user_id })
      .find(params[:id])

    send_data Base64.decode64(image.image_data),
      type: image.mime_type,
      disposition: "inline"
  end
end
