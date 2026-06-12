from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..models import BrandProfile, SocialAccount
from ..serializers import BrandProfileSerializer


def _get_owned_account(user, account_id):
    try:
        return SocialAccount.objects.get(pk=account_id, account_user=user)
    except SocialAccount.DoesNotExist:
        return None


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def brand_profile(request, account_id):
    account = _get_owned_account(request.user, account_id)
    if account is None:
        return Response({'error': 'Instagram account not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        try:
            profile = account.brand_profile
        except BrandProfile.DoesNotExist:
            return Response(BrandProfileSerializer(BrandProfile()).data)
        return Response(BrandProfileSerializer(profile).data)

    profile, _ = BrandProfile.objects.get_or_create(social_account=account)
    serializer = BrandProfileSerializer(profile, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
