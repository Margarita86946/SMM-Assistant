from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from django.db import transaction

from ..models import Post, Notification
from ..audit import log_action


def _notify(recipient, actor, notification_type, post):
    if recipient and recipient != actor:
        Notification.objects.create(
            recipient=recipient,
            actor=actor,
            notification_type=notification_type,
            post=post,
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_post(request, pk):
    with transaction.atomic():
        try:
            post = Post.objects.select_for_update(of=('self',)).select_related('client').get(pk=pk, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
        if post.status != 'draft':
            return Response(
                {'error': 'Only draft posts can be submitted for approval.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # If the client has granted full permission, auto-approve immediately
        if post.client and post.client.auto_approve:
            post.status = 'approved'
            post.approved_by = post.client
            post.approval_note = ''
            post.save(update_fields=['status', 'approved_by', 'approval_note', 'updated_at'])
            log_action(request.user, 'post_submitted', request=request, target=post)
            log_action(post.client, 'post_approved', request=request, target=post,
                       metadata={'auto_approved': True})
            # Notify specialist that it was auto-approved
            _notify(request.user, post.client, 'post_approved', post)
            return Response({'status': post.status, 'auto_approved': True})

        post.status = 'pending_approval'
        post.approval_note = ''
        post.save(update_fields=['status', 'approval_note', 'updated_at'])
    log_action(request.user, 'post_submitted', request=request, target=post)
    # Notify client that a post needs review
    _notify(post.client, request.user, 'post_submitted', post)
    return Response({'status': post.status, 'auto_approved': False})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_post(request, pk):
    with transaction.atomic():
        if request.user.role == 'client':
            try:
                post = Post.objects.select_for_update().get(pk=pk, status='pending_approval')
            except Post.DoesNotExist:
                return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            try:
                post = Post.objects.select_for_update().get(pk=pk, user=request.user)
            except Post.DoesNotExist:
                return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
            if post.status != 'pending_approval':
                return Response(
                    {'error': 'Only pending-approval posts can be approved.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        post.status = 'approved'
        post.approved_by = request.user
        post.approval_note = ''
        post.save(update_fields=['status', 'approved_by', 'approval_note', 'updated_at'])
    log_action(request.user, 'post_approved', request=request, target=post)
    # Notify specialist that client approved
    _notify(post.user, request.user, 'post_approved', post)
    return Response({'status': post.status})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_post(request, pk):
    note = (request.data.get('note') or '').strip()
    with transaction.atomic():
        if request.user.role == 'client':
            try:
                post = Post.objects.select_for_update().get(pk=pk, status='pending_approval')
            except Post.DoesNotExist:
                return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            try:
                post = Post.objects.select_for_update().get(pk=pk, user=request.user)
            except Post.DoesNotExist:
                return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
            if post.status != 'pending_approval':
                return Response(
                    {'error': 'Only pending-approval posts can be rejected.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        # Rejection sends the post back to draft so the specialist can fix and resubmit.
        post.status = 'draft'
        post.approval_note = note
        post.save(update_fields=['status', 'approval_note', 'updated_at'])
    log_action(
        request.user, 'post_rejected', request=request, target=post,
        metadata={'note_length': len(note)},
    )
    # Notify specialist that client rejected
    _notify(post.user, request.user, 'post_rejected', post)
    return Response({'status': post.status})
