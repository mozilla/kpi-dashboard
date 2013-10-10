/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This forces a logout on the user.
(function() {
  "use strict";

  navigator.id.watch({
    onlogin: function() {
      // ignore this, we are forcing the user to sign out.
    },
    onlogout: function() {
      document.location = "/";
    }
  });
  navigator.id.logout();
}());

