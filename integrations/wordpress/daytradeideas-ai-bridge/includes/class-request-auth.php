<?php

namespace DTIAI\Bridge;

use WP_REST_Request;

if (!defined('ABSPATH')) {
    exit;
}

final class Request_Auth
{
    public static function verify(WP_REST_Request $request): bool
    {
        $secret = Settings::secret();
        if (strlen($secret) < 32) {
            return false;
        }

        $timestamp = (string) $request->get_header('x-dtiai-timestamp');
        $nonce = (string) $request->get_header('x-dtiai-nonce');
        $signature = (string) $request->get_header('x-dtiai-signature');
        if (!ctype_digit($timestamp) || strlen($nonce) < 16 || strlen($signature) !== 64) {
            return false;
        }
        if (abs(time() - (int) $timestamp) > 300) {
            return false;
        }
        $nonce_key = 'dtiai_nonce_' . hash('sha256', $nonce);
        if (get_transient($nonce_key)) {
            return false;
        }

        $payload = $timestamp . "\n" . $nonce . "\n" . $request->get_body();
        $expected = hash_hmac('sha256', $payload, $secret);
        if (!hash_equals($expected, strtolower($signature))) {
            return false;
        }
        set_transient($nonce_key, 1, 600);
        return true;
    }

    public static function signed_headers(string $body): array
    {
        $timestamp = (string) time();
        $nonce = wp_generate_uuid4();
        $payload = $timestamp . "\n" . $nonce . "\n" . $body;
        return [
            'Content-Type' => 'application/json',
            'X-DTIAI-Timestamp' => $timestamp,
            'X-DTIAI-Nonce' => $nonce,
            'X-DTIAI-Signature' => hash_hmac('sha256', $payload, Settings::secret()),
        ];
    }
}

