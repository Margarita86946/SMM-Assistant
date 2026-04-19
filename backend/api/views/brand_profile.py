from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..models import BrandProfile
from ..serializers import BrandProfileSerializer


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def brand_profile(request):
    profile, _ = BrandProfile.objects.get_or_create(user=request.user)
    if request.method == 'GET':
        return Response(BrandProfileSerializer(profile).data)

    serializer = BrandProfileSerializer(profile, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)