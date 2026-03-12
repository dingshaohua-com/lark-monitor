from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
# from server.utils.db_helper import init_db, close_db
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from server.router.index import router
from server.exception.biz_error import BizError
from server.exception.error_handler import biz_error_handler, global_error_handler
from server.middleware.response_wrapper import wrap_response

load_dotenv()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # await init_db()
    yield
    # await close_db()


server = FastAPI(lifespan=lifespan)

server.add_exception_handler(BizError, biz_error_handler)
server.add_exception_handler(Exception, global_error_handler)
server.middleware("http")(wrap_response)

server.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=600,
)

server.include_router(router)
server.mount("/", StaticFiles(directory="server/static", html=True), name="static")
