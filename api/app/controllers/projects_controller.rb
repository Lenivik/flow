class ProjectsController < ApplicationController
  before_action :set_project, only: [ :show, :update, :destroy ]

  def index
    projects = Current.session.user.projects.order(updated_at: :desc)
    render json: projects.map { |p| project_json(p) }
  end

  def show
    render json: project_json_with_canvas(@project)
  end

  def create
    project = Current.session.user.projects.build(project_params)
    if project.save
      render json: project_json(project), status: :created
    else
      render json: { errors: project.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @project.update(project_params)
      render json: project_json(@project)
    else
      render json: { errors: @project.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @project.destroy
    head :no_content
  end

  private

  def set_project
    @project = Current.session.user.projects.find(params[:id])
  end

  def project_params
    params.permit(:name)
  end

  def project_json(project)
    { id: project.id, name: project.name, created_at: project.created_at, updated_at: project.updated_at }
  end

  def project_json_with_canvas(project)
    {
      id: project.id,
      name: project.name,
      nodes: project.nodes.includes(:node_images).map { |n|
        latest_image = n.node_images.order(created_at: :desc).first
        node_data = n.data || {}
        node_data = node_data.merge("activeImageId" => latest_image.id) if latest_image
        { id: n.id.to_s, type: n.node_type, position: { x: n.position_x, y: n.position_y }, data: node_data }
      },
      edges: project.edges.map { |e|
        { id: e.id.to_s, source: e.source_node_id.to_s, target: e.target_node_id.to_s, sourceHandle: e.source_handle, targetHandle: e.target_handle }
      }
    }
  end
end
