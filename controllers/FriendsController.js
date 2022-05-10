import { getSyncDBConn } from "../common/sqlConnection.js";
import {
  readUserDataRequest,
  getUserDataById,
  setUserFriendIdsDataById,
} from "../dbCreateRequests/UserInfoRequests.js";
import {
  addUnacceptedFriendReq,
  getFriendsDataByIdReq,
} from "../dbCreateRequests/FriendRequests.js";
import {
  createNewFriendNotifactionsReq,
  setUserNotificationFriendList,
  getUserNotificationsDataById,
} from "../dbCreateRequests/NotificationsRequest.js";
import { getFilteredUsers } from "../common/filters.js";
import {
  EMPTY_USER_ID,
  EMPTY_FRIEND_ID,
} from "../constans/types/exceptions.js";

class FriendsController {
  async getNewFriends(req, res) {
    try {
      let { userId, ...filterData } = req.body;
      if (userId) {
        const conn = await getSyncDBConn();
        const [usersData] = await conn.execute(readUserDataRequest());
        conn.close();
        const friendsData = await this.#getUserFriendsData(userId);
        filterData.friendsData = friendsData;
        filterData.selfId = userId;
        const filteredUsers = getFilteredUsers(usersData, filterData);
        res.json(filteredUsers);
      } else res.status(400).json({ message: EMPTY_USER_ID });
    } catch (e) {
      console.log(e);
      res.status(500).json(e);
    }
  }

  async #getUserFriendsData(userId) {
    let result = [];
    let conn = null;
    try {
      conn = await getSyncDBConn();
      const [userData] = await conn.execute(getUserDataById(userId));
      const userFriendsDataIds = userData[0]?.userFriendsDataArr?.split(",");
      for (let i of userFriendsDataIds) {
        const [friendData] = await conn.execute(getFriendsDataByIdReq(i));
        result.push(friendData[0]);
      }
    } catch (e) {
      console.log(e);
    }
    conn && conn.close();
    return result;
  }

  async #setFriendNotificationData(userId, notificationDataId) {
    try {
      const conn = await getSyncDBConn();
      const [userData] = await conn.execute(getUserDataById(userId));
      const userNotificationsId = userData[0]?.notificationsDataId;
      const [userNotificationsData] = await conn.execute(
        getUserNotificationsDataById(userNotificationsId)
      );
      const notificationsFriends = userNotificationsData[0]?.newFriendsList;
      const typeNotificationsFriends = typeof notificationsFriends;
      switch (typeNotificationsFriends) {
        case "string":
          const newNotificationsFriends = `${notificationsFriends},${notificationDataId}`;
          await conn.execute(
            setUserNotificationFriendList(
              userNotificationsId,
              newNotificationsFriends
            )
          );
          break;
        default:
          await conn.execute(
            setUserNotificationFriendList(
              userNotificationsId,
              notificationDataId
            )
          );
          break;
      }
      conn.close();
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  }

  async #setUserFriendIdsData(userId, userFriendDataId) {
    try {
      const conn = await getSyncDBConn();
      const [userData] = await conn.execute(getUserDataById(userId));
      const userFriendsData = userData[0]?.userFriendsDataArr;
      const typeUserFriendsData = typeof userFriendsData;

      switch (typeUserFriendsData) {
        case "string":
          const newFriendsList = `${userFriendsData},${userFriendDataId}`;
          await conn.execute(setUserFriendIdsDataById(userId, newFriendsList));
          break;
        default:
          await conn.execute(setUserFriendIdsDataById(userId, userFriendDataId));
          break;
      }
      conn.close();
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  }

  async sendInvite(req, res) {
    const { userId, friendId } = req.body;
    try {
      const conn = await getSyncDBConn();
      !userId && res.status(400).json({ message: EMPTY_USER_ID });
      !friendId && res.status(400).json({ message: EMPTY_FRIEND_ID });

      const [newFriendRowData] = await conn.execute(
        addUnacceptedFriendReq(userId, friendId)
      );
      const [newNotificationRowData] = await conn.execute(
        createNewFriendNotifactionsReq(friendId, userId)
      );
      conn.close();
      const friendDataId = newFriendRowData.insertId;
      const notificationDataId = newNotificationRowData.insertId;

      this.#setFriendNotificationData(friendId, notificationDataId);
      this.#setUserFriendIdsData(userId, friendDataId);

      res.json({ message: "it's okay" });
    } catch (e) {
      res.status(500).json(e);
    }
  }
}

export default FriendsController;
