class Node < ApplicationRecord
  belongs_to :project
  has_many :node_images, dependent: :destroy
end
