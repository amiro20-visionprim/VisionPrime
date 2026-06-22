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
				html = '<p class="vp-wallet-balance">' + vpEscapeHtml( String( data.balanceCents ?? 0 ) ) + '</p>';
				break;
			case 'points':
				html = data.enabled
					? '<p class="vp-points-balance">' + vpEscapeHtml( String( data.balanceCents ?? 0 ) ) + '</p>'
					: '<p class="vp-disabled">' + vpEscapeHtml( visionprimePublic.genericError ) + '</p>';
				break;
			case 'rewards':
				html = data.enabled
					? '<ul class="vp-rewards-list"></ul>'
					: '<p class="vp-disabled"></p>';
				break;
			case 'tier':
				html = '<p class="vp-tier">' + vpEscapeHtml( data.tier ? String( data.tier ) : '' ) + '</p>';
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

	$( function () {
		$( '.vp-component' ).each( function () {
			loadComponent( $( this ) );
		} );

		$( document ).on( 'click', '.vp-refresh', function () {
			refreshComponent( $( this ).closest( '.vp-component' ) );
		} );
	} );
} )( jQuery );
