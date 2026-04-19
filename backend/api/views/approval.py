from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..models import Post


def _get_owned_post(user, pk):
    try:
        return Post.objects.get(pk=pk, user=user)
    except Post.DoesNotExist:
        return None


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_post(request, pk):
    post = _get_owned_post(request.user, pk)
    if post is None:
        return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
    if post.status not in {'draft', 'ready_to_post'}:
        return Response(
            {'error': 'Only draft or ready-to-post items can be submitted for approval.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    post.status = 'pending_approval'
    post.approval_note = ''
    post.save(update_fields=['status', 'approval_note', 'updated_at'])
    return Response({'status': post.status})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_post(request, pk):
    post = _get_owned_post(request.user, pk)
    if post is None:
        return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
    post.status = 'approved'
    post.approved_by = request.user
    post.approval_note = ''
    post.save(update_fields=['status', 'approved_by', 'approval_note', 'updated_at'])
    return Response({'status': post.status})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_post(request, pk):
    post = _get_owned_post(request.user, pk)
    if post is None:
        return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
    note = request.data.get('note', '') or ''
    post.status = 'rejected'
    post.approval_note = note
    post.save(update_fields=['status', 'approval_note', 'updated_at'])
    return Response({'status': post.status})