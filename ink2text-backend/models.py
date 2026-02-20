from extensions import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = "users"

    user_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship with documents
    documents = db.relationship("Document", backref="user", lazy=True, cascade="all, delete-orphan")

    def set_password(self, password):
        """Hash and set the password"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Check if password matches the hash"""
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        """Convert user to dictionary (without password)"""
        return {
            "user_id": self.user_id,
            "name": self.name,
            "email": self.email,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S")
        }


class Document(db.Model):
    __tablename__ = "documents"

    document_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship with OCR text
    ocr_texts = db.relationship("OCRText", backref="document", lazy=True, cascade="all, delete-orphan")


class OCRText(db.Model):
    __tablename__ = "ocr_text"

    ocr_id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(
        db.Integer,
        db.ForeignKey("documents.document_id", ondelete="CASCADE"),
        nullable=False
    )
    extracted_text = db.Column(db.Text, nullable=False)
    confidence_score = db.Column(db.Float)

