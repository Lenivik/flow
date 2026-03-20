class CreateNodes < ActiveRecord::Migration[8.0]
  def change
    create_table :nodes do |t|
      t.references :project, null: false, foreign_key: true
      t.string :node_type
      t.string :label
      t.float :position_x
      t.float :position_y
      t.json :data

      t.timestamps
    end
  end
end
