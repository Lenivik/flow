Rails.application.routes.draw do
  post "signup", to: "registrations#create"
  post "login", to: "sessions#create"
  get "me", to: "sessions#show"
  delete "logout", to: "sessions#destroy"

  resources :projects, only: [ :index, :show, :create, :update, :destroy ] do
    post "canvas/save", to: "canvas#save"
  end

  get "up" => "rails/health#show", as: :rails_health_check
end
