from .authentication import (
    register,
    login_view,
    logout_view,
    profile_view,
    change_password,
)
from .posts import (
    posts_list,
    post_detail,
    calendar_view,
    today_posts,
)
from .approval import (
    submit_post,
    approve_post,
    reject_post,
)
from .dashboard import (
    dashboard_stats,
    dashboard_activity,
)
from .ai_content import (
    ai_status,
    generate_content,
    polish_content_view,
    generate_image,
    generate_variants,
)
from .brand_profile import brand_profile
from .instagram import (
    instagram_oauth_start,
    instagram_oauth_callback,
    instagram_disconnect,
    instagram_status,
    publish_post_now,
)
from .invitations import (
    invitations_list,
    invitation_detail,
    invitation_lookup,
    clients_list,
    client_detail,
)
from .email_config import email_config_view
from .audit_logs import audit_logs_view
from .notifications import notifications_list, mark_read, mark_all_read
