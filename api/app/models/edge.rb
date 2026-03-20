class Edge < ApplicationRecord
  belongs_to :project
  belongs_to :source_node, class_name: "Node"
  belongs_to :target_node, class_name: "Node"
end
