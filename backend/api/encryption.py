import base64
import hashlib
import logging
import secrets

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from django.conf import settings

logger = logging.getLogger('api')

NONCE_SIZE = 12
KEY_SIZE = 32
TAG_SIZE = 16
FORMAT_PREFIX = 'v1'
HKDF_INFO = b'smm-assistant-data-key-v1'


class DecryptionError(Exception):
    pass


def _master_key_bytes():
    raw = getattr(settings, 'MASTER_ENCRYPTION_KEY', '') or ''
    if not raw:
        raise DecryptionError('MASTER_ENCRYPTION_KEY is not configured')
    try:
        key = bytes.fromhex(raw)
    except ValueError as e:
        raise DecryptionError('MASTER_ENCRYPTION_KEY must be a hex string') from e
    if len(key) < 32:
        raise DecryptionError('MASTER_ENCRYPTION_KEY must be at least 32 bytes (64 hex chars)')
    return key


def _derive_key(key_id: int) -> bytes:
    salt = str(int(key_id)).encode('utf-8').rjust(16, b'\x00')
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=KEY_SIZE,
        salt=salt,
        info=HKDF_INFO,
    )
    return hkdf.derive(_master_key_bytes())


def get_active_key_id() -> int:
    from .models import EncryptionKey
    return EncryptionKey.get_active().id


def encrypt(plaintext, key_id=None):
    if plaintext is None or plaintext == '':
        return None
    if key_id is None:
        key_id = get_active_key_id()
    try:
        data_key = _derive_key(int(key_id))
        nonce = secrets.token_bytes(NONCE_SIZE)
        aes = AESGCM(data_key)
        combined = aes.encrypt(nonce, plaintext.encode('utf-8'), None)
        ciphertext = combined[:-TAG_SIZE]
        tag = combined[-TAG_SIZE:]
        return '{}:{}:{}:{}:{}'.format(
            FORMAT_PREFIX,
            int(key_id),
            base64.b64encode(nonce).decode('ascii'),
            base64.b64encode(ciphertext).decode('ascii'),
            base64.b64encode(tag).decode('ascii'),
        )
    except DecryptionError:
        raise
    except Exception as e:
        logger.error('Encryption failed: %s', e)
        raise DecryptionError('Encryption failed') from e


def decrypt(encrypted_blob):
    if encrypted_blob is None or encrypted_blob == '':
        return None
    try:
        parts = encrypted_blob.split(':')
        if len(parts) != 5 or parts[0] != FORMAT_PREFIX:
            raise DecryptionError('Invalid encrypted blob format')
        key_id = int(parts[1])
        nonce = base64.b64decode(parts[2])
        ciphertext = base64.b64decode(parts[3])
        tag = base64.b64decode(parts[4])
        data_key = _derive_key(key_id)
        aes = AESGCM(data_key)
        plaintext_bytes = aes.decrypt(nonce, ciphertext + tag, None)
        return plaintext_bytes.decode('utf-8')
    except DecryptionError:
        raise
    except Exception as e:
        logger.error('Decryption failed: %s', e)
        raise DecryptionError('Decryption failed') from e


def encrypt_email(email, key_id=None):
    if email is None or email == '':
        return None
    return encrypt(email.strip().lower(), key_id)


def hash_token(token: str) -> str:
    if token is None:
        token = ''
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def generate_secure_token(length: int = 48) -> str:
    return secrets.token_urlsafe(length)
