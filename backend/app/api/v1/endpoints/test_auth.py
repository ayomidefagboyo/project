"""
Test authentication endpoint - for development only
"""

from fastapi import APIRouter, HTTPException
from app.core.database import get_supabase_admin, Tables
from app.services.auth_service import auth_service
from datetime import datetime
import uuid

router = APIRouter()

@router.get("/create-test-token")
async def create_test_token():
    """
    Create a test JWT token for development/testing

    WARNING: This endpoint should only be used in development!
    """
    try:
        # Create mock user data for testing
        test_user_id = str(uuid.uuid4())
        test_outlet_id = str(uuid.uuid4())

        token_data = {
            "sub": test_user_id,
            "outlet_id": test_outlet_id,
            "role": "outlet_admin",
            "email": "test@example.com"
        }

        access_token = auth_service.create_access_token(token_data)

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": auth_service.access_token_expire_minutes * 60,
            "user_id": test_user_id,
            "outlet_id": test_outlet_id,
            "test_curl_command": f'''curl -X GET "http://localhost:8002/api/v1/pos/products?outlet_id={test_outlet_id}" -H "Authorization: Bearer {access_token}" -H "Content-Type: application/json"'''
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/test-database")
async def test_database_connection():
    """Test database connection"""
    try:
        supabase = get_supabase_admin()

        # Test query to check connection
        result = supabase.table(Tables.POS_PRODUCTS).select("count", count="exact").execute()

        return {
            "status": "connected",
            "message": "Database connection successful",
            "products_count": result.count or 0
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

@router.get("/products-no-auth")
async def get_products_no_auth(outlet_id: str = "test"):
    """Get products without authentication - FOR TESTING ONLY"""
    try:
        supabase = get_supabase_admin()

        # Build query
        query = supabase.table(Tables.POS_PRODUCTS).select('*')
        if outlet_id != "test":
            query = query.eq('outlet_id', outlet_id)

        result = query.execute()

        return {
            "items": result.data or [],
            "total": len(result.data) if result.data else 0,
            "page": 1,
            "size": 50
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch products: {str(e)}")

@router.post("/products-no-auth")
async def create_product_no_auth(product_data: dict):
    """Create product without authentication - FOR TESTING ONLY"""
    try:
        supabase = get_supabase_admin()

        # Add default values for testing
        product_data.update({
            "id": str(uuid.uuid4()),
            "outlet_id": product_data.get("outlet_id", "test"),
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        })

        result = supabase.table(Tables.POS_PRODUCTS).insert(product_data).execute()

        if not result.data:
            raise HTTPException(status_code=400, detail="Failed to create product")

        return {
            "success": True,
            "product": result.data[0],
            "message": "Product created successfully"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create product: {str(e)}")