from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

rajesh_hash = "$2b$12$7ZODamVi0k6ww2Wd0LlKC.8sItcTYxZLSiAf5lw6ktMomAOLZ9/Si"
murugan_hash = "$2b$12$gwhPLH1EJM5a2BbLNXeAW.URcitj9oc/NZ3wAegtQd46pc8210v7W"

for p in ["admin123", "06022006", "08052008"]:
    print(f"Rajesh Hash matches '{p}'? {pwd_context.verify(p, rajesh_hash)}")
    print(f"Murugan Hash matches '{p}'? {pwd_context.verify(p, murugan_hash)}")
