import mysql from "mysql";

const MAP_OLD_FORUM = new Map();
MAP_OLD_FORUM.set("1", "3");
MAP_OLD_FORUM.set("3", "2");
MAP_OLD_FORUM.set("4", "2");
MAP_OLD_FORUM.set("5", "2");
MAP_OLD_FORUM.set("6", "2");
MAP_OLD_FORUM.set("7", "1");
const newForumStatic = [0, 0, 0, 0];

const MAP_OLD_ATTACH = new Map();
const MAP_IS_FIRST_PID = new Map();
const ATTACH_ARRAY: Array<IAttachArray> = [];
const THREAD_PURCHASE_ARRAY: Array<IThreadPurchase> = [];

interface IThreadPurchase {
    tid: string;
    creditsType: number;
    credits: number;
}

interface IAttachArray {
    aid: string;
    tid: string;
    pid: string;
}

(async () => {
    const connection = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "P@ssw0rd",
        database: "rabbit",
        port: 3306
    });

    connection.connect();
    connection.beginTransaction();

    const oldData = require("./old.json");
    console.log("Migrating data...");
    {
        const [obj] = oldData.filter((item: any) => item.type === "table" && item.name === "bbs_user");
        for (let j = 0; j < obj.data.length; j++) {
            const data = obj.data[j];
            connection.query(
                `INSERT INTO \`user\`(uid, username, realname, gid, credits, golds, rmbs, password, salt, gender, email, mobile, qq, wechat, signature, createDate, loginDate) 
                        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                    data.uid,
                    data.username,
                    data.realname,
                    "2",
                    data.credits,
                    data.golds,
                    data.rmbs,
                    data.password,
                    data.salt,
                    "0",
                    data.email,
                    data.mobile,
                    data.qq,
                    "",
                    data.sign,
                    new Date(data.create_date * 1000)
                        .toISOString()
                        .replace(/T/, " ")
                        .replace(/\..+/, ""),
                    new Date(data.login_date * 1000)
                        .toISOString()
                        .replace(/T/, " ")
                        .replace(/\..+/, "")
                ]
            );
        }
    }
    {
        const [obj] = oldData.filter((item: any) => item.type === "table" && item.name === "bbs_attach");

        for (let j = 0; j < obj.data.length; j++) {
            const data = obj.data[j];

            const newFileName = `2019/08/30/` + data.filename.substr(7);
            MAP_OLD_ATTACH.set(data.filename, data.aid);

            ATTACH_ARRAY.push({
                pid: data.pid,
                tid: data.tid,
                aid: data.aid
            });

            connection.query(
                `INSERT INTO attach(aid, tid, pid, uid, fileSize, downloads, fileName, originalName, createDate)
                            VALUES(?,?,?,?,?,?,?,?,?)`,
                [
                    data.aid,
                    data.tid,
                    data.pid,
                    data.uid,
                    data.filesize,
                    data.downloads,
                    newFileName,
                    data.orgfilename,
                    new Date(data.create_date * 1000)
                        .toISOString()
                        .replace(/T/, " ")
                        .replace(/\..+/, "")
                ]
            );
        }
    }
    {
        const [obj] = oldData.filter((item: any) => item.type === "table" && item.name === "bbs_post");

        for (let j = 0; j < obj.data.length; j++) {
            const data = obj.data[j];

            let newMessage = data.message as string;
            [...MAP_OLD_ATTACH].forEach(([oldStr, newStr]) => {
                newMessage = newMessage.replace(
                    new RegExp(`upload/attach/${oldStr}`, "g"),
                    `/api/file/picture/${newStr}`
                );
            });

            if (data.isfirst) {
                MAP_IS_FIRST_PID.set(data.tid, data.pid);
            }

            connection.query(
                `INSERT INTO post(pid, uid, tid, quotepid, isFirst, message, createDate)
                            VALUES(?,?,?,?,?,?,?)`,
                [
                    data.pid,
                    data.uid,
                    data.tid,
                    data.quotepid,
                    data.isfirst,
                    newMessage,
                    new Date(data.create_date * 1000)
                        .toISOString()
                        .replace(/T/, " ")
                        .replace(/\..+/, "")
                ]
            );
        }
    }
    {
        const [obj] = oldData.filter((item: any) => item.type === "table" && item.name === "bbs_thread");

        for (let j = 0; j < obj.data.length; j++) {
            const data = obj.data[j];
            const newFid = MAP_OLD_FORUM.get(data.fid);
            newForumStatic[newFid]++;

            const [content_buy_type, content_buy_number] = [
                Number.parseInt(data.content_buy_type),
                Number.parseInt(data.content_buy)
            ];
            THREAD_PURCHASE_ARRAY.push({
                tid: data.tid,
                creditsType: content_buy_type,
                credits: content_buy_number
            });

            connection.query(
                `INSERT INTO thread(tid, fid, uid, subject, posts, isTop, isClosed, diamond, lastuid, firstpid, lastpid, createDate, replyDate)
                            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                    data.tid,
                    newFid,
                    data.uid,
                    data.subject,
                    data.posts,
                    data.top,
                    data.closed,
                    data.digest,
                    data.lastuid,
                    data.firstpid,
                    data.lastpid,
                    new Date(data.create_date * 1000)
                        .toISOString()
                        .replace(/T/, " ")
                        .replace(/\..+/, ""),
                    new Date(data.last_date * 1000)
                        .toISOString()
                        .replace(/T/, " ")
                        .replace(/\..+/, "")
                ]
            );
        }
    }
    {
        const [obj] = oldData.filter((item: any) => item.type === "table" && item.name === "bbs_tt_user_oauth");

        for (let j = 0; j < obj.data.length; j++) {
            const data = obj.data[j];
            connection.query(
                `INSERT INTO oauth(uid, platform, openid)
                            VALUES(?,?,?)`,
                [data.uid, data.platid, data.openid]
            );
        }
    }
    {
        const [obj] = oldData.filter((item: any) => item.type === "table" && item.name === "bbs_paylist");

        const purchasedAttachArray = ATTACH_ARRAY.filter(item => {
            return MAP_IS_FIRST_PID.get(item.tid) === item.pid;
        });

        for (let j = 0; j < obj.data.length; j++) {
            const data = obj.data[j];

            const resultArr = purchasedAttachArray.filter(item => item.tid === data.tid);
            resultArr.forEach(item => {
                connection.query(
                    `INSERT INTO attach_pay_log(aid, uid, creditsType, credits, createDate) 
                                VALUES(?,?,?,?,?)`,
                    [
                        item.aid,
                        data.uid,
                        data.credit_type,
                        data.num,
                        new Date(data.paytime * 1000)
                            .toISOString()
                            .replace(/T/, " ")
                            .replace(/\..+/, "")
                    ]
                );
            });
        }
    }

    console.log("Update statics");
    for (let i = 1; i <= 3; i++) {
        connection.query(`UPDATE forum SET threads = ? WHERE fid = ?`, [newForumStatic[i], i]);
    }
    console.log("Update attach pay info");
    for (let i = 0; i < THREAD_PURCHASE_ARRAY.length; i++) {
        const obj = THREAD_PURCHASE_ARRAY[i];
        const result = ATTACH_ARRAY.filter(item => item.tid === obj.tid);

        for (let j = 0; j < result.length; j++) {
            const data = result[j];
            connection.query(`UPDATE attach SET creditsType = ?, credits = ? WHERE aid = ?`, [
                obj.creditsType,
                obj.credits,
                data.aid
            ]);
        }
    }
    connection.commit();
})();
