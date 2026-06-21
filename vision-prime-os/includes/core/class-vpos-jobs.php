<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Background job dispatch (Master Spec §31). Uses Action Scheduler when
 * available (bundled with WooCommerce or as a library) for real queuing
 * with retries; falls back to WP-Cron single events otherwise. Every job
 * handler must be idempotent — this layer does not deduplicate for you.
 */
class VPOS_Jobs {

	private static $instance;

	public static function instance() {
		if ( ! self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function register_hooks() {
		// Handlers attach with add_action( 'vpos_job_{name}', $callback ).
	}

	public static function has_action_scheduler() {
		return function_exists( 'as_schedule_single_action' );
	}

	/** Enqueue a job to run as soon as possible. */
	public static function enqueue( $job, array $args = array(), $group = 'vpos' ) {
		$hook = "vpos_job_{$job}";
		if ( self::has_action_scheduler() ) {
			return as_schedule_single_action( time(), $hook, array( $args ), $group );
		}
		return wp_schedule_single_event( time() + 1, $hook, array( $args ) );
	}

	/** Enqueue a job to run at a specific time (epoch seconds). */
	public static function enqueue_at( $timestamp, $job, array $args = array(), $group = 'vpos' ) {
		$hook = "vpos_job_{$job}";
		if ( self::has_action_scheduler() ) {
			return as_schedule_single_action( $timestamp, $hook, array( $args ), $group );
		}
		return wp_schedule_single_event( $timestamp, $hook, array( $args ) );
	}

	/** Enqueue a recurring job. $interval_seconds is used for WP-Cron fallback only. */
	public static function enqueue_recurring( $job, $interval_seconds, array $args = array(), $group = 'vpos' ) {
		$hook = "vpos_job_{$job}";
		if ( self::has_action_scheduler() ) {
			if ( ! as_next_scheduled_action( $hook, array( $args ), $group ) ) {
				as_schedule_recurring_action( time(), $interval_seconds, $hook, array( $args ), $group );
			}
			return;
		}
		if ( ! wp_next_scheduled( $hook, array( $args ) ) ) {
			wp_schedule_event( time(), 'vpos_' . $interval_seconds . 's', $hook, array( $args ) );
		}
	}
}
