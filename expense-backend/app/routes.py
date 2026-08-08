from flask import Blueprint, request, jsonify
from app import db
from app.models import Transaction

bp = Blueprint('transactions', __name__)

VALID_CATEGORIES = ['Alimentation', 'Transport', 'Logement', 'Santé', 'Loisirs', 'Autre']

# ─── Health check ────────────────────────────────────────────────────────────
@bp.route('/health')
def health():
    return jsonify({'status': 'UP', 'message': 'API is running'})

# ─── GET all transactions ─────────────────────────────────────────────────────
@bp.route('/transaction', methods=['GET'])
def get_all():
    transactions = Transaction.query.order_by(Transaction.created_at.desc()).all()
    return jsonify({
        'result': [t.to_dict() for t in transactions],
        'count':  len(transactions)
    })

# ─── POST — add transaction ───────────────────────────────────────────────────
@bp.route('/transaction', methods=['POST'])
def add():
    data = request.get_json()

    # Validation
    if not data:
        return jsonify({'message': 'Body JSON requis'}), 400
    if not data.get('amount'):
        return jsonify({'message': 'Le champ amount est requis'}), 400
    if not data.get('desc') and not data.get('description'):
        return jsonify({'message': 'Le champ desc est requis'}), 400

    try:
        amount = float(data['amount'])
        if amount <= 0:
            return jsonify({'message': 'Le montant doit être positif'}), 400
    except (ValueError, TypeError):
        return jsonify({'message': 'Le montant doit être un nombre'}), 400

    description = data.get('desc') or data.get('description')
    category    = data.get('category', 'Autre')

    if category not in VALID_CATEGORIES:
        category = 'Autre'

    t = Transaction(
        amount      = amount,
        description = description,
        category    = category
    )
    db.session.add(t)
    db.session.commit()

    return jsonify({
        'message':     'Transaction ajoutée avec succès',
        'transaction': t.to_dict()
    }), 201

# ─── GET by ID ────────────────────────────────────────────────────────────────
@bp.route('/transaction/<int:id>', methods=['GET'])
def get_by_id(id):
    t = Transaction.query.get(id)
    if not t:
        return jsonify({'message': f'Transaction {id} non trouvée'}), 404
    return jsonify(t.to_dict())

# ─── DELETE by ID ─────────────────────────────────────────────────────────────
@bp.route('/transaction/<int:id>', methods=['DELETE'])
def delete_by_id(id):
    t = Transaction.query.get(id)
    if not t:
        return jsonify({'message': f'Transaction {id} non trouvée'}), 404
    db.session.delete(t)
    db.session.commit()
    return jsonify({'message': f'Transaction {id} supprimée avec succès'})

# ─── DELETE all ───────────────────────────────────────────────────────────────
@bp.route('/transaction', methods=['DELETE'])
def delete_all():
    count = Transaction.query.count()
    Transaction.query.delete()
    db.session.commit()
    return jsonify({'message': f'{count} transactions supprimées'})

# ─── Global error handlers ───────────────────────────────────────────────────
@bp.app_errorhandler(404)
def not_found(e):
    return jsonify({'message': 'Route non trouvée'}), 404

@bp.app_errorhandler(500)
def server_error(e):
    return jsonify({'message': 'Erreur serveur interne'}), 500
