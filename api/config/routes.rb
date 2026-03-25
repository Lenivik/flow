Rails.application.routes.draw do
  post "signup", to: "registrations#create"
  post "login", to: "sessions#create"
  get "me", to: "sessions#show"
  delete "logout", to: "sessions#destroy"

  resources :projects, only: [ :index, :show, :create, :update, :destroy ] do
    post "canvas/save", to: "canvas#save"
    post "canvas/operations", to: "canvas#operations"
  end

  post "generate/image", to: "generate#image"
  post "generate/flux2_flash", to: "generate#flux2_flash"
  post "generate/remove_bg", to: "generate#remove_bg"
  post "generate/trellis", to: "generate#trellis"
  get "node_images/:id", to: "node_images#show"
  get "nodes/:node_id/images", to: "node_images#index"

  get "up" => "rails/health#show", as: :rails_health_check
end
