class RegistrationsController < ApplicationController
  allow_unauthenticated_access only: [ :create ]

  def create
    user = User.new(user_params)
    if user.save
      session = start_new_session_for(user)
      token = generate_token_for(session)
      render json: { token: token, user: { id: user.id, email_address: user.email_address } }, status: :created
    else
      render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def user_params
    params.permit(:email_address, :password, :password_confirmation)
  end
end
