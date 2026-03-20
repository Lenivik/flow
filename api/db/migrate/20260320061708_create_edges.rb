class CreateEdges < ActiveRecord::Migration[8.0]
  def change
    create_table :edges do |t|
      t.references :project, null: false, foreign_key: true
      t.references :source_node, null: false, foreign_key: { to_table: :nodes }
      t.references :target_node, null: false, foreign_key: { to_table: :nodes }
      t.string :source_handle
      t.string :target_handle

      t.timestamps
    end
  end
end
