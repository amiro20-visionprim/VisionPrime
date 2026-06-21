<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Thin CRUD base every module repository extends, so pagination,
 * soft-delete, and branch-scoping (Master Spec §6-7) are written once.
 */
abstract class VPOS_Repository {

	/** @var string unprefixed table name */
	protected $table;
	protected $soft_deletable = true;
	protected $branch_scoped  = false;

	protected function table_name() {
		return VPOS_Migrator::table( $this->table );
	}

	public function find( $id ) {
		global $wpdb;
		$sql = "SELECT * FROM {$this->table_name()} WHERE id = %d";
		if ( $this->soft_deletable ) {
			$sql .= ' AND deleted_at IS NULL';
		}
		return $wpdb->get_row( $wpdb->prepare( $sql, $id ), ARRAY_A );
	}

	public function paginate( array $where = array(), $page = 1, $limit = 20, $order_by = 'id DESC' ) {
		global $wpdb;
		$page  = max( 1, (int) $page );
		$limit = max( 1, min( 200, (int) $limit ) );

		list( $clause, $values ) = $this->build_where( $where );

		$total_sql = "SELECT COUNT(*) FROM {$this->table_name()} {$clause}";
		$total     = (int) $wpdb->get_var( $values ? $wpdb->prepare( $total_sql, $values ) : $total_sql );

		$offset    = ( $page - 1 ) * $limit;
		$list_sql  = "SELECT * FROM {$this->table_name()} {$clause} ORDER BY {$order_by} LIMIT %d OFFSET %d";
		$list_vals = array_merge( $values, array( $limit, $offset ) );
		$rows      = $wpdb->get_results( $wpdb->prepare( $list_sql, $list_vals ), ARRAY_A );

		return array( 'items' => $rows, 'total' => $total, 'page' => $page, 'limit' => $limit );
	}

	public function insert( array $data ) {
		global $wpdb;
		$now = current_time( 'mysql', true );
		$data = array_merge( array( 'created_at' => $now, 'updated_at' => $now ), $data );
		$wpdb->insert( $this->table_name(), $data );
		return (int) $wpdb->insert_id;
	}

	public function update( $id, array $data ) {
		global $wpdb;
		$data['updated_at'] = current_time( 'mysql', true );
		return $wpdb->update( $this->table_name(), $data, array( 'id' => $id ) );
	}

	public function soft_delete( $id ) {
		global $wpdb;
		return $wpdb->update(
			$this->table_name(),
			array( 'deleted_at' => current_time( 'mysql', true ) ),
			array( 'id' => $id )
		);
	}

	protected function build_where( array $where ) {
		global $wpdb;
		$clauses = array();
		$values  = array();

		if ( $this->soft_deletable && ! isset( $where['_include_deleted'] ) ) {
			$clauses[] = 'deleted_at IS NULL';
		}
		unset( $where['_include_deleted'] );

		if ( $this->branch_scoped ) {
			$ctx = VPOS_Context::resolve();
			if ( ! $ctx['is_super_admin'] && ! empty( $ctx['branch_ids'] ) ) {
				$placeholders = implode( ',', array_fill( 0, count( $ctx['branch_ids'] ), '%d' ) );
				$clauses[]    = "branch_id IN ({$placeholders})";
				$values        = array_merge( $values, $ctx['branch_ids'] );
			}
		}

		foreach ( $where as $column => $value ) {
			if ( is_array( $value ) ) {
				$placeholders = implode( ',', array_fill( 0, count( $value ), '%s' ) );
				$clauses[]    = "{$column} IN ({$placeholders})";
				$values        = array_merge( $values, $value );
			} else {
				$clauses[] = "{$column} = %s";
				$values[]  = $value;
			}
		}

		$clause = $clauses ? 'WHERE ' . implode( ' AND ', $clauses ) : '';
		return array( $clause, $values );
	}
}
