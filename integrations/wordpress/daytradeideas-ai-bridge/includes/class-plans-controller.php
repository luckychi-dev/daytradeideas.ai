<?php

namespace DTIAI\Bridge;

use WP_REST_Request;

if (!defined('ABSPATH')) {
    exit;
}

final class Plans_Controller
{
    private const CACHE_KEY = 'dtiai_membership_plans';
    private const CACHE_TTL = 300;

    public function __construct()
    {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    public function register_routes(): void
    {
        register_rest_route('dtiai/v1', '/plans', [
            'methods' => 'POST',
            'permission_callback' => [Request_Auth::class, 'verify'],
            'callback' => [$this, 'plans'],
        ]);
    }

    public function plans(WP_REST_Request $request)
    {
        $cached = get_transient(self::CACHE_KEY);
        if (is_array($cached)) {
            return ['plans' => $cached];
        }

        if (!function_exists('wc_get_products') || !class_exists('WC_Subscriptions_Product')) {
            return new \WP_Error(
                'dtiai_plans_unavailable',
                'Subscription products are unavailable.',
                ['status' => 503],
            );
        }

        $plans = [];
        foreach (wc_get_products([
            'status' => 'publish',
            'limit' => -1,
            'type' => ['subscription', 'variable-subscription'],
        ]) as $product) {
            if (!\WC_Subscriptions_Product::is_subscription($product)) {
                continue;
            }
            $sale_price = $product->get_sale_price();
            $plans[] = [
                'product_id' => $product->get_id(),
                'name' => wp_strip_all_tags($product->get_name()),
                'description' => wp_strip_all_tags(wp_trim_words(
                    $product->get_short_description(),
                    32,
                )),
                'price' => (float) $product->get_price(),
                'regular_price' => (float) $product->get_regular_price(),
                'sale_price' => $sale_price === '' ? null : (float) $sale_price,
                'currency' => get_woocommerce_currency(),
                'billing_period' => \WC_Subscriptions_Product::get_period($product),
                'billing_interval' => (int) \WC_Subscriptions_Product::get_interval($product),
                'purchase_url' => get_permalink($product->get_id()),
            ];
        }

        usort($plans, static fn(array $a, array $b): int => $a['price'] <=> $b['price']);
        set_transient(self::CACHE_KEY, $plans, self::CACHE_TTL);
        return ['plans' => $plans];
    }
}
