class CreateNodeImages < ActiveRecord::Migration[8.0]
  def change
    create_table :node_images do |t|
      t.references :node, null: false, foreign_key: true
      t.text :image_data
      t.string :mime_type
      t.text :prompt
      t.text :negative_prompt

      t.timestamps
    end
  end
end
