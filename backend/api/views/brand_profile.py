from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..models import BrandProfile
from ..serializers import BrandProfileSerializer


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def brand_profile(request):
    if request.user.role == 'specialist':
        return Response(
            {'error': 'Specialists do not have a personal brand profile. Each client manages their own.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    if request.method == 'GET':
        try:
            profile = BrandProfile.objects.get(user=request.user)
        except BrandProfile.DoesNotExist:
            return Response(BrandProfileSerializer(BrandProfile()).data)
        return Response(BrandProfileSerializer(profile).data)

    profile, _ = BrandProfile.objects.get_or_create(user=request.user)
    serializer = BrandProfileSerializer(profile, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)