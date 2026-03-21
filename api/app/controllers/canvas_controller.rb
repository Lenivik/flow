class CanvasController < ApplicationController
  before_action :set_project

  def save
    ActiveRecord::Base.transaction do
      # Must destroy edges first to avoid foreign key violations when deleting nodes
      @project.edges.destroy_all
      sync_nodes(params[:nodes] || [])
      sync_edges(params[:edges] || [])
    end

    render json: { message: "Canvas saved", id_map: @id_map || {} }
  end

  def operations
    @client_to_server = {}

    ActiveRecord::Base.transaction do
      (params[:operations] || []).each do |op|
        type = op[:type]
        payload = op[:payload]

        case type
        when "node_create"
          node = @project.nodes.create!(
            node_type: payload[:type],
            label: payload.dig(:data, :label),
            position_x: payload.dig(:position, :x),
            position_y: payload.dig(:position, :y),
            data: payload[:data]
          )
          @client_to_server[payload[:client_id]] = node.id.to_s
        when "node_update"
          node_id = resolve_id(payload[:id])
          node = @project.nodes.find(node_id)
          attrs = {}
          if payload[:position]
            attrs[:position_x] = payload[:position][:x]
            attrs[:position_y] = payload[:position][:y]
          end
          attrs[:data] = payload[:data] if payload[:data]
          node.update!(attrs) if attrs.present?
        when "node_delete"
          node_id = resolve_id(payload[:id])
          @project.nodes.find(node_id).destroy!
        when "edge_create"
          source_id = resolve_id(payload[:source])
          target_id = resolve_id(payload[:target])
          edge = @project.edges.create!(
            source_node_id: source_id,
            target_node_id: target_id,
            source_handle: payload[:source_handle],
            target_handle: payload[:target_handle]
          )
          @client_to_server[payload[:client_id]] = edge.id.to_s
        when "edge_delete"
          edge_id = resolve_id(payload[:id])
          @project.edges.find(edge_id).destroy!
        end
      end
    end

    render json: { id_map: @client_to_server }
  end

  private

  def resolve_id(id)
    @client_to_server[id.to_s] || id
  end

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
    valid_node_ids = @project.nodes.pluck(:id).map(&:to_s)

    edges_data.each do |edge_data|
      source_id = @id_map[edge_data[:source].to_s] || edge_data[:source]
      target_id = @id_map[edge_data[:target].to_s] || edge_data[:target]

      next unless valid_node_ids.include?(source_id.to_s) && valid_node_ids.include?(target_id.to_s)

      @project.edges.create!(
        source_node_id: source_id,
        target_node_id: target_id,
        source_handle: edge_data[:sourceHandle],
        target_handle: edge_data[:targetHandle]
      )
    end
  end
end
