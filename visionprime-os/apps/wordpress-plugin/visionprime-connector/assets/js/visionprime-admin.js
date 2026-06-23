/**
 * Drives the settings-page admin tools (Test Connection, Register
 * Webhooks, Sync Current User, Clear Cache, Send Test Event) and the
 * sync status panel. All run via AJAX — none submit the settings form
 * or reload the page.
 */
( function ( $ ) {
	'use strict';

	var BUTTON_ACTIONS = {
		'vp-test-connection': 'vp_test_connection',
		'vp-register-webhooks': 'vp_register_webhooks',
		'vp-sync-current-user': 'vp_sync_current_user',
		'vp-clear-cache': 'vp_clear_cache',
		'vp-send-test-event': 'vp_send_test_event',
	};

	function vpEscapeHtml( text ) {
		return $( '<div>' ).text( text ).html();
	}

	function showResult( message, isError ) {
		var $result = $( '#vp-connection-result' );
		$result
			.removeClass( 'vp-success vp-error' )
			.addClass( isError ? 'vp-error' : 'vp-success' )
			.text( message );
	}

	function runAction( action, $button ) {
		var $allButtons = $( Object.keys( BUTTON_ACTIONS ).map( function ( id ) {
			return '#' + id;
		} ).join( ',' ) );

		$allButtons.prop( 'disabled', true );
		$button.addClass( 'vp-is-loading' );

		$.post( visionprimeAdmin.ajaxUrl, {
			action: action,
			nonce: visionprimeAdmin.nonce,
		} )
			.done( function ( response ) {
				if ( response && response.success ) {
					showResult( ( response.data && response.data.message ) || 'Done.', false );
				} else {
					showResult( ( response && response.data && response.data.message ) || visionprimeAdmin.genericError, true );
				}
			} )
			.fail( function () {
				showResult( visionprimeAdmin.genericError, true );
			} )
			.always( function () {
				$allButtons.prop( 'disabled', false );
				$button.removeClass( 'vp-is-loading' );
				loadSyncStatus();
			} );
	}

	function loadSyncStatus() {
		var $status = $( '#vp-sync-status' );

		$.post( visionprimeAdmin.ajaxUrl, {
			action: 'vp_get_sync_status',
			nonce: visionprimeAdmin.nonce,
		} )
			.done( function ( response ) {
				if ( ! response || ! response.success ) {
					$status.text( visionprimeAdmin.genericError );
					return;
				}

				var data  = response.data || {};
				var lines = ( data.logs || [] ).map( function ( entry ) {
					return vpEscapeHtml( '[' + entry.level + '] ' + entry.message );
				} );

				$status.html(
					'<p>' + ( data.configured ? 'Configured' : 'Not configured yet' ) + '</p>' +
					'<pre class="vp-log">' + lines.join( '\n' ) + '</pre>'
				);
			} )
			.fail( function () {
				$status.text( visionprimeAdmin.genericError );
			} );
	}

	$( function () {
		$.each( BUTTON_ACTIONS, function ( id, action ) {
			$( '#' + id ).on( 'click', function () {
				runAction( action, $( this ) );
			} );
		} );

		loadSyncStatus();
	} );
} )( jQuery );
