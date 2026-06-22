/**
 * Drives every shortcode / My Account tab container rendered by
 * VP_Shortcodes / VP_My_Account. Each container carries its own
 * data-vp-component + data-vp-nonce attributes, so this script never
 * needs a single global nonce and can support multiple independent
 * components on the same page (e.g. a page with both [visionprime_wallet]
 * and [visionprime_points]).
 */
( function ( $ ) {
	'use strict';

	var COMPONENT_ACTIONS = {
		club: 'vp_get_customer_dashboard',
		wallet: 'vp_get_wallet',
		points: 'vp_get_points',
		rewards: 'vp_get_rewards',
		tier: 'vp_get_tier',
	};

	function setLoading( $container, isLoading ) {
		$container.toggleClass( 'vp-is-loading', isLoading );
		$container.find( '.vp-refresh' ).prop( 'disabled', isLoading );
	}

	function vpEscapeHtml( text ) {
		return $( '<div>' ).text( text ).html();
	}

	function renderError( $container, message ) {
		$container.html( '<p class="vp-error">' + vpEscapeHtml( message ) + '</p><button type="button" class="button vp-refresh">Refresh</button>' );
	}

	function renderComponent( $container, component, data ) {
		var html = '';

		switch ( component ) {
			case 'wallet':
				html = '<p class="vp-wallet-balance">' + vpEscapeHtml( String( data.availableBalanceCents ?? 0 ) ) + '</p>';
				break;
			case 'points':
				html = data.enabled
					? '<p class="vp-points-balance">' + vpEscapeHtml( String( data.balance ?? 0 ) ) + '</p>' +
					  '<p class="vp-points-lifetime">' + vpEscapeHtml( String( data.lifetimePoints ?? 0 ) ) + '</p>'
					: '<p class="vp-disabled">' + vpEscapeHtml( visionprimePublic.genericError ) + '</p>';
				break;
			case 'rewards':
				html = data.enabled ? '<ul class="vp-rewards-list"></ul>' : '<p class="vp-disabled"></p>';
				break;
			case 'tier':
				html = data.enabled
					? '<p class="vp-tier">' + vpEscapeHtml( data.currentTierName ? String( data.currentTierName ) : '' ) + '</p>'
					: '<p class="vp-disabled"></p>';
				break;
			case 'club':
			default:
				html = '<pre class="vp-club-data"></pre>';
				break;
		}

		html += '<button type="button" class="button vp-refresh">Refresh</button>';
		$container.html( html );

		// Bulk text payloads are rendered via .text(), never .html(), to
		// avoid any chance of customer-controlled data being interpreted
		// as markup.
		if ( 'club' === component ) {
			$container.find( '.vp-club-data' ).text( JSON.stringify( data ) );
		}

		if ( 'rewards' === component && data.enabled ) {
			renderRewardsList( $container, data );
		}
	}

	/** Renders claimed + available rewards into the [visionprime_rewards]
	 * container, with one claim/redeem button per row — every list item's
	 * customer-controlled text (reward name) goes through vpEscapeHtml. */
	function renderRewardsList( $container, data ) {
		var $list = $container.find( '.vp-rewards-list' );
		var html  = '';

		( data.claimed || [] ).forEach( function ( claim ) {
			html += '<li class="vp-reward-claim" data-vp-claim-id="' + vpEscapeHtml( claim.claimId ) + '">';
			html += '<span class="vp-reward-name">' + vpEscapeHtml( claim.name ) + '</span> ';
			html += '<span class="vp-reward-status">' + vpEscapeHtml( claim.status ) + '</span>';
			if ( 'claimed' === claim.status ) {
				html += ' <button type="button" class="button vp-reward-redeem">Redeem</button>';
			}
			html += '</li>';
		} );

		( data.available || [] ).forEach( function ( reward ) {
			html += '<li class="vp-reward-available" data-vp-reward-id="' + vpEscapeHtml( reward.id ) + '">';
			html += '<span class="vp-reward-name">' + vpEscapeHtml( reward.name ) + '</span> ';
			html += '<span class="vp-reward-cost">' + vpEscapeHtml( String( reward.pointsCost ) ) + '</span>';
			html += ' <button type="button" class="button vp-reward-claim">Claim</button>';
			html += '</li>';
		} );

		$list.html( html );
	}

	function claimReward( $container, rewardId ) {
		var nonce = $container.data( 'vp-nonce' );

		$.post( visionprimePublic.ajaxUrl, { action: 'vp_claim_reward', nonce: nonce, rewardId: rewardId } )
			.done( function ( response ) {
				if ( response && response.success ) {
					loadComponent( $container );
				} else {
					renderError( $container, ( response && response.data && response.data.message ) || visionprimePublic.genericError );
				}
			} )
			.fail( function () {
				renderError( $container, visionprimePublic.genericError );
			} );
	}

	function redeemReward( $container, claimId ) {
		var nonce = $container.data( 'vp-nonce' );

		$.post( visionprimePublic.ajaxUrl, { action: 'vp_redeem_reward', nonce: nonce, claimId: claimId } )
			.done( function ( response ) {
				if ( response && response.success ) {
					loadComponent( $container );
				} else {
					renderError( $container, ( response && response.data && response.data.message ) || visionprimePublic.genericError );
				}
			} )
			.fail( function () {
				renderError( $container, visionprimePublic.genericError );
			} );
	}

	function loadComponent( $container ) {
		var component = $container.data( 'vp-component' );
		var nonce     = $container.data( 'vp-nonce' );
		var action    = COMPONENT_ACTIONS[ component ];

		if ( ! action ) {
			return;
		}

		setLoading( $container, true );

		$.post( visionprimePublic.ajaxUrl, {
			action: action,
			nonce: nonce,
		} )
			.done( function ( response ) {
				if ( response && response.success ) {
					renderComponent( $container, component, response.data || {} );
				} else {
					renderError( $container, ( response && response.data && response.data.message ) || visionprimePublic.genericError );
				}
			} )
			.fail( function () {
				renderError( $container, visionprimePublic.genericError );
			} )
			.always( function () {
				setLoading( $container, false );
			} );
	}

	function refreshComponent( $container ) {
		var component = $container.data( 'vp-component' );
		var nonce     = $container.data( 'vp-nonce' );

		setLoading( $container, true );

		$.post( visionprimePublic.ajaxUrl, {
			action: 'vp_refresh_account_data',
			component: component,
			nonce: nonce,
		} )
			.done( function ( response ) {
				if ( response && response.success ) {
					renderComponent( $container, component, response.data || {} );
				} else {
					renderError( $container, ( response && response.data && response.data.message ) || visionprimePublic.genericError );
				}
			} )
			.fail( function () {
				renderError( $container, visionprimePublic.genericError );
			} )
			.always( function () {
				setLoading( $container, false );
			} );
	}

	/* -------------------------------------------------------------- */
	/* Checkout wallet widget (Phase 09)                               */
	/*                                                                  */
	/* Apply/remove are pure AJAX — applying triggers WooCommerce's own */
	/* `update_checkout` event so totals refresh via WC's AJAX         */
	/* mechanism (woocommerce_update_order_review), never a page reload. */
	/* -------------------------------------------------------------- */

	function renderWalletWidget( $widget, data ) {
		var reservation = data && data.reservation;
		var html        = '';

		if ( reservation && 'active' === reservation.status ) {
			html += '<p class="vp-wallet-applied">' + vpEscapeHtml( visionprimePublic.wallet.appliedMessage ) + '</p>';
			html += '<button type="button" class="button vp-wallet-remove">' + vpEscapeHtml( visionprimePublic.wallet.removeLabel ) + '</button>';
		} else {
			html += '<label for="vp-wallet-amount">' + vpEscapeHtml( ( data && data.label ) || '' ) + '</label>';
			html += '<input type="number" min="0" step="0.01" id="vp-wallet-amount" class="vp-wallet-amount" />';
			html += '<button type="button" class="button vp-wallet-apply">' + vpEscapeHtml( visionprimePublic.wallet.applyLabel ) + '</button>';
		}

		html += '<p class="vp-wallet-error" style="display:none;"></p>';
		$widget.html( html );
	}

	function showWalletBalance( $widget ) {
		var nonce = $widget.data( 'vp-nonce' );

		$.post( visionprimePublic.ajaxUrl, { action: 'vp_get_wallet', nonce: nonce } ).done( function ( response ) {
			var balanceCents = response && response.success && response.data ? response.data.availableBalanceCents : 0;
			renderWalletWidget( $widget, { label: 'Available: ' + ( ( balanceCents || 0 ) / 100 ).toFixed( 2 ) } );
		} );
	}

	function showWalletError( $widget, message ) {
		$widget.find( '.vp-wallet-error' ).text( message ).show();
	}

	function applyWalletCredit( $widget ) {
		var nonce  = $widget.data( 'vp-nonce' );
		var amount = parseFloat( $widget.find( '.vp-wallet-amount' ).val() );

		if ( ! amount || amount <= 0 ) {
			showWalletError( $widget, visionprimePublic.wallet.enterAmount );
			return;
		}

		$widget.find( '.vp-wallet-apply' ).prop( 'disabled', true );

		$.post( visionprimePublic.ajaxUrl, { action: 'vp_apply_wallet_credit', nonce: nonce, amount: amount } )
			.done( function ( response ) {
				if ( response && response.success ) {
					renderWalletWidget( $widget, response.data );
					// No full page reload: ask WooCommerce's own checkout
					// AJAX to recompute totals (woocommerce_update_order_review).
					$( document.body ).trigger( 'update_checkout' );
				} else {
					showWalletError( $widget, ( response && response.data && response.data.message ) || visionprimePublic.genericError );
					$widget.find( '.vp-wallet-apply' ).prop( 'disabled', false );
				}
			} )
			.fail( function () {
				showWalletError( $widget, visionprimePublic.genericError );
				$widget.find( '.vp-wallet-apply' ).prop( 'disabled', false );
			} );
	}

	function removeWalletCredit( $widget ) {
		var nonce = $widget.data( 'vp-nonce' );

		$widget.find( '.vp-wallet-remove' ).prop( 'disabled', true );

		$.post( visionprimePublic.ajaxUrl, { action: 'vp_remove_wallet_credit', nonce: nonce } )
			.done( function ( response ) {
				if ( response && response.success ) {
					showWalletBalance( $widget );
					$( document.body ).trigger( 'update_checkout' );
				} else {
					showWalletError( $widget, ( response && response.data && response.data.message ) || visionprimePublic.genericError );
					$widget.find( '.vp-wallet-remove' ).prop( 'disabled', false );
				}
			} )
			.fail( function () {
				showWalletError( $widget, visionprimePublic.genericError );
				$widget.find( '.vp-wallet-remove' ).prop( 'disabled', false );
			} );
	}

	$( function () {
		$( '.vp-component' ).each( function () {
			loadComponent( $( this ) );
		} );

		$( document ).on( 'click', '.vp-refresh', function () {
			refreshComponent( $( this ).closest( '.vp-component' ) );
		} );

		$( '.vp-checkout-wallet' ).each( function () {
			showWalletBalance( $( this ) );
		} );

		$( document ).on( 'click', '.vp-wallet-apply', function () {
			applyWalletCredit( $( this ).closest( '.vp-checkout-wallet' ) );
		} );

		$( document ).on( 'click', '.vp-wallet-remove', function () {
			removeWalletCredit( $( this ).closest( '.vp-checkout-wallet' ) );
		} );

		$( document ).on( 'click', '.vp-reward-claim', function () {
			var $container = $( this ).closest( '.vp-component' );
			var rewardId    = $( this ).closest( 'li' ).data( 'vp-reward-id' );
			claimReward( $container, rewardId );
		} );

		$( document ).on( 'click', '.vp-reward-redeem', function () {
			var $container = $( this ).closest( '.vp-component' );
			var claimId     = $( this ).closest( 'li' ).data( 'vp-claim-id' );
			redeemReward( $container, claimId );
		} );
	} );
} )( jQuery );
