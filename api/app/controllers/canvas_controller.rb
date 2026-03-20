class CanvasController < ApplicationController
  before_action :set_project

  def save
    ActiveRecord::Base.transaction do
      sync_nodes(params[:nodes] || [])
      sync_edges(params[:edges] || [])
    end

    render json: { message: "Canvas saved" }
  end

  private

  def set_project
    @project = Current.session.user.projects.find(params[:project_id])
  end

  def sync_nodes(nodes_data)
    incoming_ids = nodes_data.filter_map { |n| n[:id] if n[:id].to_s.match?(/\A\d+\z/) }
    @project.nodes.where.not(id: incoming_ids).destroy_all

    nodes_data.each do |node_data|
      if node_data[:id].to_s.match?(/\A\d+\z/)
        node = @project.nodes.find(node_data[:id])
        node.update!(
          node_type: node_data[:type],
          position_x: node_data.dig(:position, :x),
          position_y: node_data.dig(:position, :y),
          data: node_data[:data]
        )
      else
        node = @project.nodes.create!(
          node_type: node_data[:type],
          label: node_data.dig(:data, :label),
          position_x: node_data.dig(:position, :x),
          position_y: node_data.dig(:position, :y),
          data: node_data[:data]
        )
        node_data[:_server_id] = node.id
        node_data[:_client_id] = node_data[:id]
      end
    end

    @id_map = nodes_data.each_with_object({}) do |n, map|
      if n[:_client_id]
        map[n[:_client_id]] = n[:_server_id].to_s
      else
        map[n[:id].to_s] = n[:id].to_s
      end
    end
  end

  def sync_edges(edges_data)
    @project.edges.destroy_all

    edges_data.each do |edge_data|
      source_id = @id_map[edge_data[:source].to_s] || edge_data[:source]
      target_id = @id_map[edge_data[:target].to_s] || edge_data[:target]

      @project.edges.create!(
        source_node_id: source_id,
        target_node_id: target_id,
        source_handle: edge_data[:sourceHandle],
        target_handle: edge_data[:targetHandle]
      )
    end
  end
end
