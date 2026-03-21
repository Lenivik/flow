module Authentication
  extend ActiveSupport::Concern

  included do
    before_action :require_authentication
  end

  class_methods do
    def allow_unauthenticated_access(**options)
      skip_before_action :require_authentication, **options
    end
  end

  private
    def authenticated?
      resume_session
    end

    def require_authentication
      resume_session || request_authentication
    end

    def resume_session
      Current.session ||= find_session_by_token
    end

    def find_session_by_token
      token = request.headers["Authorization"]&.split(" ")&.last || params[:token]
      return nil unless token

      begin
        payload = JWT.decode(token, Rails.application.secret_key_base, true, algorithm: "HS256").first
        Session.find_by(id: payload["session_id"])
      rescue JWT::DecodeError
        nil
      end
    end

    def request_authentication
      render json: { error: "Unauthorized" }, status: :unauthorized
    end

    def start_new_session_for(user)
      user.sessions.create!(user_agent: request.user_agent, ip_address: request.remote_ip).tap do |session|
        Current.session = session
      end
    end

    def generate_token_for(session)
      JWT.encode({ session_id: session.id, user_id: session.user_id, exp: 30.days.from_now.to_i }, Rails.application.secret_key_base, "HS256")
    end

    def terminate_session
      Current.session.destroy
    end
end
