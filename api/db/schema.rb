# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2026_03_20_061708) do
  create_table "edges", force: :cascade do |t|
    t.integer "project_id", null: false
    t.integer "source_node_id", null: false
    t.integer "target_node_id", null: false
    t.string "source_handle"
    t.string "target_handle"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["project_id"], name: "index_edges_on_project_id"
    t.index ["source_node_id"], name: "index_edges_on_source_node_id"
    t.index ["target_node_id"], name: "index_edges_on_target_node_id"
  end

  create_table "nodes", force: :cascade do |t|
    t.integer "project_id", null: false
    t.string "node_type"
    t.string "label"
    t.float "position_x"
    t.float "position_y"
    t.json "data"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["project_id"], name: "index_nodes_on_project_id"
  end

  create_table "projects", force: :cascade do |t|
    t.string "name"
    t.integer "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_projects_on_user_id"
  end

  create_table "sessions", force: :cascade do |t|
    t.integer "user_id", null: false
    t.string "ip_address"
    t.string "user_agent"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_sessions_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email_address", null: false
    t.string "password_digest", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email_address"], name: "index_users_on_email_address", unique: true
  end

  add_foreign_key "edges", "nodes", column: "source_node_id"
  add_foreign_key "edges", "nodes", column: "target_node_id"
  add_foreign_key "edges", "projects"
  add_foreign_key "nodes", "projects"
  add_foreign_key "projects", "users"
  add_foreign_key "sessions", "users"
end
