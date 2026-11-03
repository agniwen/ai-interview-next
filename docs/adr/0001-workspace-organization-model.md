# 使用 Better Auth Organization 承载工作区成员关系

Sainoa 需要支持用户创建和加入多个工作区，且已经使用 Better Auth 处理登录。选择复用 Organization 插件维护工作区、成员、角色和邀请，产品统一称为“工作区”，避免在独立工作区模型中重复维护同一套成员与权限关系；业务数据的工作区归属与访问授权仍由业务 API 负责。
