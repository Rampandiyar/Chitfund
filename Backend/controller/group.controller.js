import Group from "../models/group.js";
import Branch from "../models/branch.js";
import Scheme from "../models/scheme.js";
import Member from "../models/member.js";

// Helper function to validate references
const validateReferences = async (branchId, schemeId, memberIds = []) => {
  const [branch, scheme] = await Promise.all([
    Branch.findById(branchId),
    Scheme.findById(schemeId)
  ]);

  if (!branch) throw new Error('Branch not found');
  if (!scheme) throw new Error('Scheme not found');

  if (memberIds.length > 0) {
    const members = await Member.countDocuments({ _id: { $in: memberIds } });
    if (members !== memberIds.length) throw new Error('One or more members not found');
  }

  return { branch, scheme };
};

// @desc    Create a new group
// @route   POST /api/groups
export const createGroup = async (req, res) => {
  try {
    const { branch_id, scheme_id, members, ...groupData } = req.body;

    // Validate references
    await validateReferences(branch_id, scheme_id, members?.map(m => m.member_id));

    // Create group
    const group = await Group.create({
      ...groupData,
      branch_id,
      scheme_id,
      members: members || []
    });

    res.status(201).json({
      success: true,
      data: group
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all groups
// @route   GET /api/groups
export const getGroups = async (req, res) => {
  try {
    const { branch_id, scheme_id, status } = req.query;
    const filter = {};

    if (branch_id) filter.branch_id = branch_id;
    if (scheme_id) filter.scheme_id = scheme_id;
    if (status) filter.status = status;

    const groups = await Group.find(filter)
      .populate('branch_id', 'branch_id bname')
      .populate('scheme_id', 'scheme_id scheme_name')
      .populate('members.member_id', 'member_id mem_name');

    res.json({
      success: true,
      count: groups.length,
      data: groups
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single group
// @route   GET /api/groups/:id
export const getGroupById = async (req, res) => {
  try {
    const group = await Group.findOne({
      $or: [
        { _id: req.params.id },
        { group_id: req.params.id }
      ]
    })
    .populate('branch_id', 'branch_id bname')
    .populate('scheme_id', 'scheme_id scheme_name duration_months')
    .populate('members.member_id', 'member_id mem_name phone');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found"
      });
    }

    res.json({
      success: true,
      data: group
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update group basic info
// @route   PUT /api/groups/:id
export const updateGroup = async (req, res) => {
  try {
    // Prevent updating group_id
    if (req.body.group_id) {
      delete req.body.group_id;
    }

    const group = await Group.findOneAndUpdate(
      { 
        $or: [
          { _id: req.params.id },
          { group_id: req.params.id }
        ]
      },
      req.body,
      { new: true, runValidators: true }
    )
    .populate('branch_id', 'branch_id bname')
    .populate('scheme_id', 'scheme_id scheme_name');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found"
      });
    }

    res.json({
      success: true,
      data: group
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Add member to group
// @route   POST /api/groups/:id/members
export const addGroupMember = async (req, res) => {
  try {
    const { member_id, payout_month } = req.body;

    // Validate member exists
    const member = await Member.findById(member_id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found"
      });
    }

    const group = await Group.findOne({
      $or: [
        { _id: req.params.id },
        { group_id: req.params.id }
      ]
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found"
      });
    }

    // Check if member already in group
    if (group.members.some(m => m.member_id.equals(member_id))) {
      return res.status(400).json({
        success: false,
        message: "Member already in group"
      });
    }

    // Check if payout month is available
    if (group.members.some(m => m.payout_month === payout_month)) {
      return res.status(400).json({
        success: false,
        message: "Payout month already assigned"
      });
    }

    // Add member to group
    group.members.push({
      member_id,
      payout_month,
      join_date: new Date()
    });

    // Update status if reaching minimum members
    const scheme = await Scheme.findById(group.scheme_id);
    if (group.members.length >= scheme.min_members && group.status === 'Forming') {
      group.status = 'Active';
    }

    await group.save();

    res.status(201).json({
      success: true,
      data: group
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Remove member from group
// @route   DELETE /api/groups/:id/members/:memberId
export const removeGroupMember = async (req, res) => {
  try {
    const group = await Group.findOne({
      $or: [
        { _id: req.params.id },
        { group_id: req.params.id }
      ]
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found"
      });
    }

    // Find member index
    const memberIndex = group.members.findIndex(m => 
      m.member_id.equals(req.params.memberId)
    );

    if (memberIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Member not found in group"
      });
    }

    // Remove member
    group.members.splice(memberIndex, 1);

    // Update status if below minimum members
    const scheme = await Scheme.findById(group.scheme_id);
    if (group.members.length < scheme.min_members && group.status === 'Active') {
      group.status = 'Forming';
    }

    await group.save();

    res.json({
      success: true,
      data: group
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Advance group to next month
// @route   POST /api/groups/:id/advance
export const advanceGroupMonth = async (req, res) => {
  try {
    const group = await Group.findOne({
      $or: [
        { _id: req.params.id },
        { group_id: req.params.id }
      ]
    }).populate('scheme_id', 'duration_months');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found"
      });
    }

    if (group.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: "Group is not active"
      });
    }

    // Check if already completed
    if (group.current_month >= group.scheme_id.duration_months) {
      group.status = 'Completed';
      await group.save();
      
      return res.json({
        success: true,
        data: group,
        message: "Group has completed its duration"
      });
    }

    // Advance to next month
    group.current_month += 1;
    await group.save();

    res.json({
      success: true,
      data: group,
      message: `Group advanced to month ${group.current_month}`
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete group
// @route   DELETE /api/groups/:id
export const deleteGroup = async (req, res) => {
  try {
    const group = await Group.findOneAndDelete({
      $or: [
        { _id: req.params.id },
        { group_id: req.params.id }
      ]
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found"
      });
    }

    res.json({
      success: true,
      data: {
        group_id: group.group_id,
        scheme_id: group.scheme_id,
        status: group.status
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};