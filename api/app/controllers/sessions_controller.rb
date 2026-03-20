class SessionsController < ApplicationController
  allow_unauthenticated_access only: [ :create ]
  rate_limit to: 10, within: 3.minutes, only: :create, with: -> { render json: { error: "Try again later" }, status: :too_many_requests }

  def create
    user = User.authenticate_by(params.permit(:email_address, :password))
    if user
      session = start_new_session_for(user)
      token = generate_token_for(session)
      render json: { token: token, user: { id: user.id, email_address: user.email_address } }
    else
      render json: { error: "Invalid email or password" }, status: :unauthorized
    end
  end

  def show
    render json: { user: { id: Current.session.user.id, email_address: Current.session.user.email_address } }
  end

  def destroy
    terminate_session
    render json: { message: "Logged out" }
  end
end
