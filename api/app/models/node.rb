class Node < ApplicationRecord
  belongs_to :project
  has_many :node_images, dependent: :destroy
  has_many :source_edges, class_name: "Edge", foreign_key: :source_node_id, dependent: :destroy
  has_many :target_edges, class_name: "Edge", foreign_key: :target_node_id, dependent: :destroy
end
